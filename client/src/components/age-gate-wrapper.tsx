import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAgeVerification } from "@/hooks/use-age-verification";
import { AgeVerificationModal } from "./age-verification-modal";
import { SafetyDisclosureModal } from "./safety-disclosure-modal";
import { VoiceConsentModal } from "./voice-consent-modal";

interface AgeGateWrapperProps {
  children: ReactNode;
}

/**
 * AgeGateWrapper manages the age verification flow for the entire application.
 * It shows the appropriate modals based on the user's verification status and
 * prevents access to protected features until verification is complete.
 */
export function AgeGateWrapper({ children }: AgeGateWrapperProps) {
  const { user, isLoading: authLoading } = useAuth();
  const {
    isLoading: verificationLoading,
    showAgeModal,
    showDisclosureModal,
    showVoiceConsentModal,
    verificationStatus,
    closeModals,
    handleAgeVerified,
    handleDisclosureAccepted,
    handleVoiceConsentGiven,
  } = useAgeVerification();

  // Show loading state while authentication or verification status is loading
  if (authLoading || verificationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, don't show age gate (auth flow handles this)
  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      
      {/* Age Verification Modal - Highest Priority */}
      <AgeVerificationModal
        isOpen={showAgeModal}
        onClose={closeModals}
        onVerified={handleAgeVerified}
      />

      {/* Safety Disclosure Modal - Second Priority */}
      <SafetyDisclosureModal
        isOpen={showDisclosureModal}
        onClose={closeModals}
        onAccepted={handleDisclosureAccepted}
        userRegion={verificationStatus?.region || undefined}
      />

      {/* Voice Consent Modal - On-Demand Only */}
      <VoiceConsentModal
        isOpen={showVoiceConsentModal}
        onClose={closeModals}
        onConsentGiven={handleVoiceConsentGiven}
        userRegion={verificationStatus?.region || undefined}
      />
    </>
  );
}