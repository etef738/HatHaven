import { Router } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { 
  dobValidationSchema, 
  verifyAgeRequirement, 
  getMinimumAge,
  requireAuth,
  getUserSafetyStatus,
  updateSafetyWarningTimestamp
} from "./middleware/trust-safety";

const router = Router();

// Age verification endpoint
router.post("/api/safety/verify-age", requireAuth, async (req, res) => {
  try {
    const { dateOfBirth, region = "US" } = dobValidationSchema.parse(req.body);
    const user = req.user!;
    
    const dob = new Date(dateOfBirth);
    
    // Verify age requirement for the specified region
    const isAgeValid = verifyAgeRequirement(dob, region);
    
    if (!isAgeValid) {
      const minimumAge = getMinimumAge(region);
      return res.status(400).json({
        error: "Age requirement not met",
        code: "AGE_REQUIREMENT_NOT_MET",
        message: `You must be at least ${minimumAge} years old to use this service`,
        minimumAge,
        region
      });
    }
    
    // Update user's age verification status
    const updatedUser = await storage.updateUserSafetyFields(user.id, {
      dateOfBirth: dob,
      region: region.toUpperCase(),
      ageVerified: true,
      ageVerificationDate: new Date()
    });
    
    // Log successful age verification
    await storage.createSafetyAuditLog({
      userId: user.id,
      contentType: "age_verification",
      originalContent: `DOB verification for region ${region}`,
      riskLevel: "low",
      concerns: ["age_verification_success"],
      actionTaken: "verified",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "unknown"
    });
    
    res.json({
      success: true,
      message: "Age verification completed successfully",
      ageVerified: true,
      region: region.toUpperCase(),
      minimumAge: getMinimumAge(region)
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input data",
        code: "VALIDATION_ERROR",
        details: error.errors
      });
    }
    
    console.error("Age verification error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    });
  }
});

// Voice consent endpoint
router.post("/api/safety/voice-consent", requireAuth, async (req, res) => {
  try {
    const { consent } = z.object({
      consent: z.boolean()
    }).parse(req.body);
    
    const user = req.user!;
    
    // Update user's voice consent status
    await storage.updateUserSafetyFields(user.id, {
      voiceConsentGiven: consent,
      voiceConsentDate: consent ? new Date() : null
    });
    
    // Log consent decision
    await storage.createSafetyAuditLog({
      userId: user.id,
      contentType: "voice_consent",
      originalContent: `Voice consent: ${consent ? "granted" : "revoked"}`,
      riskLevel: "low",
      concerns: [consent ? "voice_consent_granted" : "voice_consent_revoked"],
      actionTaken: consent ? "consent_granted" : "consent_revoked",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "unknown"
    });
    
    res.json({
      success: true,
      voiceConsentGiven: consent,
      message: consent ? "Voice consent granted" : "Voice consent revoked"
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input data",
        code: "VALIDATION_ERROR",
        details: error.errors
      });
    }
    
    console.error("Voice consent error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    });
  }
});

// Disclosure consent endpoint
router.post("/api/safety/disclosure-consent", requireAuth, async (req, res) => {
  try {
    const { consent, disclosureVersion = "1.0" } = z.object({
      consent: z.boolean(),
      disclosureVersion: z.string().optional()
    }).parse(req.body);
    
    const user = req.user!;
    
    // Update user's disclosure consent status
    await storage.updateUserSafetyFields(user.id, {
      disclosureConsentGiven: consent,
      disclosureConsentDate: consent ? new Date() : null
    });
    
    // Create disclosure record
    await storage.createSafetyDisclosure({
      userId: user.id,
      disclosureType: "ai_interaction",
      disclosureVersion,
      consentGiven: consent,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "unknown"
    });
    
    // Log consent decision
    await storage.createSafetyAuditLog({
      userId: user.id,
      contentType: "disclosure_consent",
      originalContent: `Disclosure consent v${disclosureVersion}: ${consent ? "accepted" : "declined"}`,
      riskLevel: "low",
      concerns: [consent ? "disclosure_accepted" : "disclosure_declined"],
      actionTaken: consent ? "consent_granted" : "consent_declined",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "unknown"
    });
    
    res.json({
      success: true,
      disclosureConsentGiven: consent,
      disclosureVersion,
      message: consent ? "Safety disclosures acknowledged" : "Safety disclosures declined"
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input data",
        code: "VALIDATION_ERROR",
        details: error.errors
      });
    }
    
    console.error("Disclosure consent error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    });
  }
});

// Get user safety status
router.get("/api/safety/status", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const safetyStatus = await getUserSafetyStatus(user.id);
    
    res.json({
      success: true,
      safetyStatus
    });
    
  } catch (error) {
    console.error("Safety status error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    });
  }
});

// Get regional age requirements
router.get("/api/safety/age-requirements", (req, res) => {
  const { region } = req.query;
  
  if (region && typeof region === "string") {
    const minimumAge = getMinimumAge(region);
    res.json({
      success: true,
      region: region.toUpperCase(),
      minimumAge
    });
  } else {
    // Return common regions and their requirements
    const commonRegions = {
      "US": 18,
      "GB": 18,
      "CA": 18,
      "AU": 18,
      "DE": 16,
      "FR": 18,
      "JP": 20,
      "KR": 19,
      "SG": 21,
      "DEFAULT": 18
    };
    
    res.json({
      success: true,
      regions: commonRegions
    });
  }
});

// Submit safety concern/report
router.post("/api/safety/report", requireAuth, async (req, res) => {
  try {
    const { content, contentType, reason } = z.object({
      content: z.string().max(1000),
      contentType: z.enum(["voice_session", "text_conversation", "user_behavior", "other"]),
      reason: z.string().max(500)
    }).parse(req.body);
    
    const user = req.user!;
    
    // Create audit log entry for the report
    const auditLog = await storage.createSafetyAuditLog({
      userId: user.id,
      contentType: `user_report_${contentType}`,
      originalContent: content,
      riskLevel: "medium",
      concerns: ["user_reported_content", reason],
      actionTaken: "flagged",
      escalated: true,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "unknown"
    });
    
    // Add to moderation queue
    await storage.createModerationQueueEntry({
      auditLogId: auditLog.id,
      userId: user.id,
      status: "pending",
      priority: 2 // User reports get medium priority
    });
    
    res.json({
      success: true,
      message: "Safety report submitted successfully",
      reportId: auditLog.id
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input data",
        code: "VALIDATION_ERROR",
        details: error.errors
      });
    }
    
    console.error("Safety report error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    });
  }
});

// Safety warning acknowledgment
router.post("/api/safety/acknowledge-warning", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    
    // Update user's last safety warning timestamp
    await updateSafetyWarningTimestamp(user.id);
    
    // Log warning acknowledgment
    await storage.createSafetyAuditLog({
      userId: user.id,
      contentType: "safety_warning_ack",
      originalContent: "User acknowledged safety warning",
      riskLevel: "low",
      concerns: ["safety_warning_acknowledged"],
      actionTaken: "acknowledged",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "unknown"
    });
    
    res.json({
      success: true,
      message: "Safety warning acknowledged"
    });
    
  } catch (error) {
    console.error("Safety warning ack error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    });
  }
});

// Accept disclosures endpoint (matches frontend expectations)
router.post("/api/trust-safety/accept-disclosures", requireAuth, async (req, res) => {
  try {
    const { region, acceptedAt } = z.object({
      region: z.string().optional().default("US"),
      acceptedAt: z.string().optional()
    }).parse(req.body);
    
    const user = req.user!;
    const disclosureVersion = "1.0";
    
    // Update user's disclosure consent status
    await storage.updateUserSafetyFields(user.id, {
      disclosureConsentGiven: true,
      disclosureConsentDate: new Date()
    });
    
    // Create disclosure record
    await storage.createSafetyDisclosure({
      userId: user.id,
      disclosureType: "ai_interaction",
      disclosureVersion,
      consentGiven: true,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "unknown"
    });
    
    // Log consent decision
    await storage.createSafetyAuditLog({
      userId: user.id,
      contentType: "disclosure_consent",
      originalContent: `Disclosure consent v${disclosureVersion}: accepted via accept-disclosures endpoint`,
      riskLevel: "low",
      concerns: ["disclosure_accepted"],
      actionTaken: "consent_granted",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "unknown"
    });
    
    res.json({
      success: true,
      disclosureConsentGiven: true,
      disclosureVersion,
      region,
      acceptedAt: acceptedAt || new Date().toISOString(),
      message: "Safety disclosures accepted successfully"
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input data",
        code: "VALIDATION_ERROR",
        details: error.errors
      });
    }
    
    console.error("Accept disclosures error:", error);
    res.status(500).json({
      error: "Failed to accept disclosures",
      code: "INTERNAL_ERROR"
    });
  }
});

export default router;