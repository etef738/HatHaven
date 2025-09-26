import { useState } from "react";
import { Mic, Volume2, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VoiceConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConsentGiven: () => void;
  userRegion?: string;
}

export function VoiceConsentModal({ isOpen, onClose, onConsentGiven, userRegion = "US" }: VoiceConsentModalProps) {
  const { toast } = useToast();
  const [hasReadConsent, setHasReadConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const giveVoiceConsentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trust-safety/voice-consent", {
        region: userRegion,
        consentGivenAt: new Date().toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trust-safety/age-verification-status"] });
      toast({
        title: "Voice consent granted",
        description: "You can now use voice features. You can withdraw consent at any time in settings.",
      });
      onConsentGiven();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to grant voice consent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGiveConsent = async () => {
    if (!hasReadConsent) {
      toast({
        title: "Please read the consent information",
        description: "You must read and understand the voice feature consent before proceeding.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await giveVoiceConsentMutation.mutateAsync();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh]" data-testid="voice-consent-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-blue-600" />
            Voice Features Consent
          </DialogTitle>
          <DialogDescription>
            Voice features require explicit consent. Please review the information below 
            before enabling voice interactions.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-6">
            
            {/* What Voice Features Include */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold">Voice Features Include:</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Voice-to-text transcription for conversations</li>
                  <li>Text-to-speech responses from AI companions</li>
                  <li>Real-time voice analysis for conversation quality</li>
                  <li>Voice-based dating scenario practice</li>
                  <li>Natural conversation flow improvements</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* Data Processing */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold">How Your Voice Data is Processed</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>When you use voice features, here's what happens to your data:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Recording:</strong> Your voice is recorded temporarily during conversations</li>
                  <li><strong>Transcription:</strong> Audio is converted to text using secure speech-to-text services</li>
                  <li><strong>Safety Analysis:</strong> Voice content is analyzed for safety and appropriateness</li>
                  <li><strong>PII Redaction:</strong> Personal information is automatically removed from transcripts</li>
                  <li><strong>Encryption:</strong> All voice data is encrypted in transit and at rest</li>
                  <li><strong>Retention:</strong> Original audio is deleted; only redacted transcripts are kept</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* Privacy Protection */}
            <div className="space-y-3">
              <h3 className="font-semibold">Privacy Protection Measures</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Voice processing happens in secure, encrypted environments</li>
                  <li>We do not share voice data with third parties for training or marketing</li>
                  <li>Audio files are automatically deleted after transcription</li>
                  <li>Transcripts are anonymized and PII-redacted before storage</li>
                  <li>Voice biometric data is not extracted or stored</li>
                  <li>All processing complies with data protection regulations</li>
                </ul>
                {userRegion && ["GB", "DE", "FR", "ES", "IT", "NL", "DK", "FI"].includes(userRegion) && (
                  <p className="text-blue-600 dark:text-blue-400 mt-2">
                    <strong>GDPR Compliance:</strong> Under GDPR, you have the right to access, 
                    rectify, or delete your voice data at any time.
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Technical Requirements */}
            <div className="space-y-3">
              <h3 className="font-semibold">Technical Requirements & Limitations</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Requires microphone access permission</li>
                  <li>Works best in quiet environments with minimal background noise</li>
                  <li>Internet connection required for real-time processing</li>
                  <li>Transcription accuracy may vary based on accent, speech clarity, and audio quality</li>
                  <li>Voice features may have latency depending on your connection</li>
                  <li>Some languages or dialects may have limited support</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* Safety & Monitoring */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Safety Notice:</strong> Voice conversations are subject to the same safety 
                monitoring as text conversations. Inappropriate content will be detected and may 
                result in account restrictions.
              </AlertDescription>
            </Alert>

            <Separator />

            {/* Consent Management */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Managing Your Consent</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>You have full control over voice consent:</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>You can withdraw consent at any time in your profile settings</li>
                  <li>Withdrawing consent will disable voice features immediately</li>
                  <li>Previously recorded transcripts will remain (PII-redacted) unless you request deletion</li>
                  <li>You can re-enable voice features by providing consent again</li>
                  <li>Voice consent is separate from other platform features</li>
                </ul>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="voice-consent-read" 
              checked={hasReadConsent}
              onCheckedChange={(checked) => setHasReadConsent(checked as boolean)}
              data-testid="checkbox-voice-consent-read"
            />
            <label 
              htmlFor="voice-consent-read" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I have read and understand how voice features work and consent to voice data processing
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
              onClick={handleGiveConsent}
              disabled={!hasReadConsent || isSubmitting}
              data-testid="button-give-voice-consent"
            >
              {isSubmitting ? "Granting Consent..." : "Enable Voice Features"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}