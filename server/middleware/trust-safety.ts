import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { z } from "zod";

// Region-specific age requirements (ISO country codes)
const REGIONAL_AGE_REQUIREMENTS: Record<string, number> = {
  "US": 18,   // United States
  "GB": 18,   // United Kingdom
  "CA": 18,   // Canada
  "AU": 18,   // Australia
  "DE": 16,   // Germany
  "FR": 18,   // France
  "ES": 18,   // Spain
  "IT": 18,   // Italy
  "NL": 16,   // Netherlands
  "SE": 15,   // Sweden
  "NO": 16,   // Norway
  "DK": 15,   // Denmark
  "JP": 20,   // Japan
  "KR": 19,   // South Korea
  "BR": 18,   // Brazil
  "MX": 18,   // Mexico
  "AR": 18,   // Argentina
  "CL": 18,   // Chile
  "IN": 18,   // India
  "SG": 21,   // Singapore
  "MY": 18,   // Malaysia
  "TH": 20,   // Thailand
  "PH": 18,   // Philippines
  "ID": 17,   // Indonesia
  "VN": 18,   // Vietnam
  "ZA": 18,   // South Africa
  "EG": 18,   // Egypt
  "IL": 18,   // Israel
  "TR": 18,   // Turkey
  "RU": 18,   // Russia
  "UA": 18,   // Ukraine
  "PL": 18,   // Poland
  "CZ": 18,   // Czech Republic
  "HU": 18,   // Hungary
  "RO": 18,   // Romania
  "GR": 18,   // Greece
  "PT": 18,   // Portugal
  "IE": 18,   // Ireland
  "AT": 14,   // Austria
  "CH": 16,   // Switzerland
  "BE": 16,   // Belgium
  "LU": 16,   // Luxembourg
  "FI": 13,   // Finland
  "EE": 13,   // Estonia
  "LV": 13,   // Latvia
  "LT": 14,   // Lithuania
  "SI": 15,   // Slovenia
  "SK": 16,   // Slovakia
  "HR": 16,   // Croatia
  "BG": 14,   // Bulgaria
  "CY": 14,   // Cyprus
  "MT": 16,   // Malta
  "IS": 13,   // Iceland
  "LI": 16,   // Liechtenstein
  "AD": 14,   // Andorra
  "MC": 15,   // Monaco
  "SM": 16,   // San Marino
  "VA": 18,   // Vatican City
  "DEFAULT": 18  // Default for unspecified regions
};

// DOB validation schema
export const dobValidationSchema = z.object({
  dateOfBirth: z.string().refine((date) => {
    const dob = new Date(date);
    return !isNaN(dob.getTime()) && dob < new Date();
  }, "Invalid date of birth"),
  region: z.string().optional().default("US")
});

// Calculate age from date of birth
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

// Get minimum age requirement for a region
export function getMinimumAge(region: string): number {
  return REGIONAL_AGE_REQUIREMENTS[region.toUpperCase()] || REGIONAL_AGE_REQUIREMENTS.DEFAULT;
}

// Verify if user meets age requirements for their region
export function verifyAgeRequirement(dateOfBirth: Date, region: string): boolean {
  const age = calculateAge(dateOfBirth);
  const minimumAge = getMinimumAge(region);
  return age >= minimumAge;
}

// Middleware: Require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
  }
  next();
}

// Middleware: Require admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
  }

  const user = req.user!;
  
  if (!user.isAdmin) {
    return res.status(403).json({
      error: "Admin access required",
      code: "ADMIN_ACCESS_REQUIRED",
      message: "You must have admin privileges to access this resource"
    });
  }

  next();
}

// Middleware: Require moderator or admin role  
export function requireModerator(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
  }

  const user = req.user!;
  
  if (!user.isModerator && !user.isAdmin) {
    return res.status(403).json({
      error: "Moderator access required",
      code: "MODERATOR_ACCESS_REQUIRED", 
      message: "You must have moderator or admin privileges to access this resource"
    });
  }

  next();
}

// Middleware: Require age verification
export async function requireAgeVerification(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
  }

  const user = req.user!;
  
  // Check if user has completed age verification
  if (!user.ageVerified || !user.dateOfBirth) {
    return res.status(403).json({
      error: "Age verification required",
      code: "AGE_VERIFICATION_REQUIRED",
      message: "You must verify your age before accessing this feature"
    });
  }

  // Double-check age requirement (defensive programming)
  const isAgeValid = verifyAgeRequirement(user.dateOfBirth, user.region);
  if (!isAgeValid) {
    return res.status(403).json({
      error: "Age requirement not met",
      code: "AGE_REQUIREMENT_NOT_MET",
      message: `You must be at least ${getMinimumAge(user.region)} years old to access this feature`
    });
  }

  next();
}

// Middleware: Require voice consent
export async function requireVoiceConsent(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
  }

  const user = req.user!;
  
  // Check if user has given voice consent
  if (!user.voiceConsentGiven) {
    return res.status(403).json({
      error: "Voice interaction consent required",
      code: "VOICE_CONSENT_REQUIRED",
      message: "You must consent to voice interactions before accessing this feature"
    });
  }

  next();
}

// Middleware: Require disclosure acknowledgment
export async function requireDisclosureConsent(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
  }

  const user = req.user!;
  
  // Check if user has acknowledged safety disclosures
  if (!user.disclosureConsentGiven) {
    return res.status(403).json({
      error: "Safety disclosure acknowledgment required",
      code: "DISCLOSURE_CONSENT_REQUIRED",
      message: "You must acknowledge our safety disclosures before proceeding"
    });
  }

  next();
}

// Combined middleware: Full safety gate for voice features
export function requireFullVoiceSafety(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, (err: any) => {
    if (err) return next(err);
    
    requireAgeVerification(req, res, (err: any) => {
      if (err) return next(err);
      
      requireVoiceConsent(req, res, (err: any) => {
        if (err) return next(err);
        
        requireDisclosureConsent(req, res, next);
      });
    });
  });
}

// Combined middleware: Full safety gate for text features  
export function requireFullTextSafety(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, (err: any) => {
    if (err) return next(err);
    
    requireAgeVerification(req, res, (err: any) => {
      if (err) return next(err);
      
      requireDisclosureConsent(req, res, next);
    });
  });
}

// Middleware: Rate limiting for safety warnings
const SAFETY_WARNING_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

export async function checkSafetyWarningCooldown(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return next();
  }

  const user = req.user!;
  
  if (user.lastSafetyWarning) {
    const timeSinceLastWarning = Date.now() - user.lastSafetyWarning.getTime();
    if (timeSinceLastWarning < SAFETY_WARNING_COOLDOWN) {
      req.skipSafetyWarning = true;
    }
  }

  next();
}

// Utility function: Update user safety warning timestamp
export async function updateSafetyWarningTimestamp(userId: string): Promise<void> {
  await storage.updateUserSafetyFields(userId, {
    lastSafetyWarning: new Date()
  });
}

// Utility function: Get user's safety compliance status
export async function getUserSafetyStatus(userId: string) {
  const safetyStatus = await storage.getUserSafetyStatus(userId);
  if (!safetyStatus) {
    return {
      ageVerified: false,
      voiceConsentGiven: false,
      disclosureConsentGiven: false,
      region: "US",
      compliance: {
        canAccessText: false,
        canAccessVoice: false,
        missingRequirements: ["age_verification", "voice_consent", "disclosure_consent"]
      }
    };
  }

  const missingRequirements: string[] = [];
  if (!safetyStatus.ageVerified) missingRequirements.push("age_verification");
  if (!safetyStatus.voiceConsentGiven) missingRequirements.push("voice_consent");
  if (!safetyStatus.disclosureConsentGiven) missingRequirements.push("disclosure_consent");

  return {
    ...safetyStatus,
    compliance: {
      canAccessText: safetyStatus.ageVerified && safetyStatus.disclosureConsentGiven,
      canAccessVoice: safetyStatus.ageVerified && safetyStatus.voiceConsentGiven && safetyStatus.disclosureConsentGiven,
      missingRequirements
    }
  };
}

// Extended Express Request type for TypeScript
declare global {
  namespace Express {
    interface Request {
      skipSafetyWarning?: boolean;
    }
  }
}