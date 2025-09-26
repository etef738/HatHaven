import { useState } from "react";
import { AlertTriangle, Shield, Eye, Brain, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { APP_NAME, BRAND_MESSAGING } from "@/branding/brand";

interface SafetyDisclosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccepted: () => void;
  userRegion?: string;
}

export function SafetyDisclosureModal({ isOpen, onClose, onAccepted, userRegion = "US" }: SafetyDisclosureModalProps) {
  const { toast } = useToast();
  const [hasReadDisclosures, setHasReadDisclosures] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const acceptDisclosuresMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trust-safety/accept-disclosures", {
        region: userRegion,
        acceptedAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trust-safety/age-verification-status"] });
      toast({
        title: "Safety disclosures accepted",
        description: "Thank you for reviewing our safety guidelines. You can now access all features.",
      });
      onAccepted();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept disclosures",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAccept = async () => {
    if (!hasReadDisclosures) {
      toast({
        title: "Please read the disclosures",
        description: "You must read and acknowledge all safety disclosures before continuing.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await acceptDisclosuresMutation.mutateAsync();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]" data-testid="safety-disclosure-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Safety Disclosures & Guidelines
          </DialogTitle>
          <DialogDescription>
            Please read these important safety guidelines before using Heart & Playground.
            Your safety and well-being are our top priorities.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-6">
            
            {/* Platform Purpose */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <h3 className="font-semibold">Platform Purpose</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  {APP_NAME} is designed for adults 18+ to practice dating conversations 
                  and interact with AI companions in a safe, supportive environment.
                </p>
                <p>
                  Our platform uses advanced AI technology to help you improve social skills, 
                  build confidence, and explore emotional connections through conversation.
                </p>
              </div>
            </div>

            <Separator />

            {/* AI Interaction Guidelines */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold">AI Interaction Guidelines</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Remember:</strong> {BRAND_MESSAGING.voiceDisclosure} AI responses are generated based on training data and may not 
                  always be accurate or appropriate.
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>AI companions cannot provide professional medical, legal, or therapeutic advice</li>
                  <li>Conversations are designed for practice and entertainment purposes</li>
                  <li>Do not share sensitive personal information (SSN, passwords, addresses)</li>
                  <li>AI responses should not be considered as professional guidance or real relationships</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* Content Safety */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold">Content Safety & Moderation</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Our platform employs comprehensive safety measures to ensure appropriate interactions:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>All conversations are monitored by AI safety systems</li>
                  <li>Inappropriate content is automatically detected and blocked</li>
                  <li>Harmful, illegal, or explicit content is prohibited</li>
                  <li>Violations may result in account suspension or termination</li>
                  <li>Content that violates our policies is escalated to human moderators</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* Mental Health & Crisis Support */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Mental Health Notice:</strong> If you're experiencing thoughts of self-harm 
                or crisis, please seek immediate help from qualified professionals. 
                <br />
                <br />
                <strong>Crisis Resources:</strong>
                <br />
                • US: 988 (Suicide & Crisis Lifeline) - Available 24/7
                <br />
                • Crisis Text Line: Text HOME to 741741
                <br />
                • International: Contact local emergency services or mental health professionals
              </AlertDescription>
            </Alert>

            <Separator />

            {/* Privacy & Data Protection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold">Privacy & Data Protection</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  We are committed to protecting your privacy and personal data:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Conversations are encrypted and stored securely</li>
                  <li>Personal information is redacted from safety logs</li>
                  <li>We comply with data protection regulations (GDPR, CCPA, etc.)</li>
                  <li>You can request data deletion at any time</li>
                  <li>Voice data is processed securely and not shared with third parties</li>
                </ul>
                {userRegion && ["GB", "DE", "FR", "ES", "IT", "NL", "DK", "FI"].includes(userRegion) && (
                  <p className="text-blue-600 dark:text-blue-400">
                    <strong>GDPR Notice:</strong> As a {userRegion} resident, you have additional 
                    rights under GDPR including data portability, right to be forgotten, and 
                    detailed consent management.
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Voice Features Disclaimer */}
            <div className="space-y-3">
              <h3 className="font-semibold">Voice Features</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Voice interactions require additional consent and are subject to enhanced monitoring:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Voice data is processed for transcription and safety analysis</li>
                  <li>Audio quality may affect transcription accuracy</li>
                  <li>Voice consent can be withdrawn at any time in settings</li>
                  <li>Voice features are disabled for unverified users</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* Age Verification Reminder */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Age Verification Requirement</h3>
              <p className="text-sm text-muted-foreground">
                This platform is strictly for adults 18 years and older. Age verification helps us:
              </p>
              <ul className="list-disc pl-4 text-sm text-muted-foreground mt-2 space-y-1">
                <li>Ensure compliance with regional age requirements</li>
                <li>Provide age-appropriate content and interactions</li>
                <li>Protect minors from accessing adult-oriented content</li>
                <li>Maintain legal compliance across different jurisdictions</li>
              </ul>
            </div>
          </div>
        </ScrollArea>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="disclosures-read" 
              checked={hasReadDisclosures}
              onCheckedChange={(checked) => setHasReadDisclosures(checked as boolean)}
              data-testid="checkbox-disclosures-read"
            />
            <label 
              htmlFor="disclosures-read" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I have read and understand all safety disclosures and guidelines
            </label>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAccept}
              disabled={!hasReadDisclosures || isSubmitting}
              data-testid="button-accept-disclosures"
            >
              {isSubmitting ? "Accepting..." : "Accept & Continue"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}