import { useState, useEffect } from "react";
import { useAuth } from "./use-auth";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "../lib/queryClient";

interface AgeVerificationStatus {
  ageVerified: boolean;
  region: string | null;
  dateOfBirth: string | null;
  ageVerificationDate: string | null;
  voiceConsentGiven: boolean;
  disclosureConsentGiven: boolean;
  requiresAgeVerification: boolean;
  requiresVoiceConsent: boolean;
  requiresDisclosureConsent: boolean;
}

interface RegionalAgeRequirement {
  minAge: number;
  voiceConsentRequired: boolean;
  additionalDisclosures: string[];
}

// Regional age requirements and compliance rules
const REGIONAL_REQUIREMENTS: Record<string, RegionalAgeRequirement> = {
  US: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: [] },
  GB: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: ["GDPR"] },
  CA: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: ["PIPEDA"] },
  AU: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: [] },
  DE: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: ["GDPR"] },
  FR: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: ["GDPR"] },
  ES: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: ["GDPR"] },
  IT: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: ["GDPR"] },
  NL: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: ["GDPR"] },
  SE: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: ["GDPR"] },
  NO: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: [] },
  DK: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: ["GDPR"] },
  FI: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: ["GDPR"] },
  JP: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: [] },
  KR: { minAge: 19, voiceConsentRequired: true, additionalDisclosures: [] },
  OTHER: { minAge: 18, voiceConsentRequired: true, additionalDisclosures: [] },
};

export function useAgeVerification() {
  const { user, isLoading: authLoading } = useAuth();
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showVoiceConsentModal, setShowVoiceConsentModal] = useState(false);
  const [showDisclosureModal, setShowDisclosureModal] = useState(false);

  // Query age verification status
  const { 
    data: verificationStatus, 
    isLoading: statusLoading,
    error: statusError 
  } = useQuery<AgeVerificationStatus>({
    queryKey: ["/api/trust-safety/age-verification-status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user && !authLoading,
  });

  const isLoading = authLoading || statusLoading;

  // Calculate verification requirements
  const calculateRequirements = (): {
    requiresAgeVerification: boolean;
    requiresVoiceConsent: boolean;
    requiresDisclosureConsent: boolean;
    regionalRequirement: RegionalAgeRequirement;
  } => {
    if (!user || !verificationStatus) {
      return {
        requiresAgeVerification: true,
        requiresVoiceConsent: true,
        requiresDisclosureConsent: true,
        regionalRequirement: REGIONAL_REQUIREMENTS.US,
      };
    }

    const region = verificationStatus.region || "US";
    const regionalRequirement = REGIONAL_REQUIREMENTS[region] || REGIONAL_REQUIREMENTS.OTHER;

    // Check if age verification is needed
    const requiresAgeVerification = !verificationStatus.ageVerified;

    // Check if voice consent is needed (for voice features)
    const requiresVoiceConsent = regionalRequirement.voiceConsentRequired && 
                                 !verificationStatus.voiceConsentGiven;

    // Check if disclosure consent is needed
    const requiresDisclosureConsent = !verificationStatus.disclosureConsentGiven;

    return {
      requiresAgeVerification,
      requiresVoiceConsent,
      requiresDisclosureConsent,
      regionalRequirement,
    };
  };

  const requirements = calculateRequirements();

  // Auto-show modals based on requirements
  useEffect(() => {
    if (isLoading || !user) return;

    // Show age verification modal first (highest priority)
    if (requirements.requiresAgeVerification && !showAgeModal) {
      setShowAgeModal(true);
      return;
    }

    // Show disclosure modal next
    if (!requirements.requiresAgeVerification && 
        requirements.requiresDisclosureConsent && 
        !showDisclosureModal) {
      setShowDisclosureModal(true);
      return;
    }

    // Voice consent is shown on-demand, not automatically
  }, [
    isLoading, 
    user, 
    requirements.requiresAgeVerification, 
    requirements.requiresDisclosureConsent,
    showAgeModal,
    showDisclosureModal
  ]);

  // Helper functions
  const isFullyVerified = (): boolean => {
    return !requirements.requiresAgeVerification && 
           !requirements.requiresDisclosureConsent;
  };

  const canUseVoiceFeatures = (): boolean => {
    return isFullyVerified() && !requirements.requiresVoiceConsent;
  };

  const canUseDatingScenarios = (): boolean => {
    // Dating scenarios require full verification including age verification
    return !requirements.requiresAgeVerification && 
           !requirements.requiresDisclosureConsent;
  };

  const getBlockedFeatureMessage = (feature: 'voice' | 'scenarios' | 'general'): string => {
    if (requirements.requiresAgeVerification) {
      return "Age verification is required to access this feature. Please verify your age in your profile settings.";
    }
    
    if (feature === 'voice' && requirements.requiresVoiceConsent) {
      return "Voice consent is required to use voice features. Please provide consent in your profile settings.";
    }
    
    if (requirements.requiresDisclosureConsent) {
      return "Please review and accept our safety disclosures to continue using this feature.";
    }
    
    return "This feature requires additional verification. Please check your profile settings.";
  };

  const getRegionalRequirement = (): RegionalAgeRequirement => {
    return requirements.regionalRequirement;
  };

  const closeModals = () => {
    setShowAgeModal(false);
    setShowVoiceConsentModal(false);
    setShowDisclosureModal(false);
  };

  const handleAgeVerified = () => {
    setShowAgeModal(false);
    // Auto-show disclosure modal after age verification if needed
    if (requirements.requiresDisclosureConsent) {
      setTimeout(() => setShowDisclosureModal(true), 500);
    }
  };

  const handleDisclosureAccepted = () => {
    setShowDisclosureModal(false);
  };

  const handleVoiceConsentGiven = () => {
    setShowVoiceConsentModal(false);
  };

  const requestVoiceConsent = () => {
    if (requirements.requiresVoiceConsent) {
      setShowVoiceConsentModal(true);
    }
  };

  return {
    // Status
    isLoading,
    statusError,
    verificationStatus,
    
    // Requirements
    requiresAgeVerification: requirements.requiresAgeVerification,
    requiresVoiceConsent: requirements.requiresVoiceConsent,
    requiresDisclosureConsent: requirements.requiresDisclosureConsent,
    regionalRequirement: requirements.regionalRequirement,
    
    // Capability checks
    isFullyVerified: isFullyVerified(),
    canUseVoiceFeatures: canUseVoiceFeatures(),
    canUseDatingScenarios: canUseDatingScenarios(),
    
    // Modal state
    showAgeModal,
    showVoiceConsentModal,
    showDisclosureModal,
    
    // Actions
    closeModals,
    handleAgeVerified,
    handleDisclosureAccepted,
    handleVoiceConsentGiven,
    requestVoiceConsent,
    
    // Helpers
    getBlockedFeatureMessage,
    getRegionalRequirement,
  };
}