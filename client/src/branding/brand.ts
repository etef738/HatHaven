// HeartScene Brand Constants and Theme
export const APP_NAME = "HeartScene";
export const APP_SHORT = "HS";
export const APP_TAGLINE = "AI Companion & Dating Training";

// Brand Colors (Tailwind-compatible)
export const BRAND_COLORS = {
  primary: "#e11d48",     // Tailwind rose-600
  secondary: "#6d28d9",   // violet-700
  accent: "#f59e0b",      // amber-500
  dark: "#0f172a",        // slate-900
  light: "#f8fafc",       // slate-50
  success: "#10b981",     // emerald-500
  warning: "#f59e0b",     // amber-500
  error: "#ef4444",       // red-500
} as const;

// Brand Typography
export const BRAND_TYPOGRAPHY = {
  fontFamily: {
    primary: ['Inter', 'system-ui', 'sans-serif'],
    secondary: ['SF Pro Display', 'system-ui', 'sans-serif'],
  }
} as const;

// Brand Gradients
export const BRAND_GRADIENTS = {
  primary: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%)`,
  accent: `linear-gradient(135deg, ${BRAND_COLORS.accent} 0%, ${BRAND_COLORS.primary} 100%)`,
  dark: `linear-gradient(135deg, ${BRAND_COLORS.dark} 0%, #1e293b 100%)`,
} as const;

// Brand Shadows
export const BRAND_SHADOWS = {
  subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  large: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  brand: `0 10px 25px -5px ${BRAND_COLORS.primary}40, 0 4px 10px -2px ${BRAND_COLORS.primary}20`,
} as const;

// Brand Messaging
export const BRAND_MESSAGING = {
  description: "Advanced AI companion for emotional connection and dating skill development",
  disclaimer: `${APP_NAME} is an AI companion & coaching tool and is not a substitute for professional therapy.`,
  voiceDisclosure: `You are interacting with AI in ${APP_NAME}.`,
  ageGateTitle: `Welcome to ${APP_NAME}`,
  ageGateSubtitle: "You must be 18 or older to use this service",
} as const;

// Export type for better TypeScript support
export type BrandColors = typeof BRAND_COLORS;
export type BrandGradients = typeof BRAND_GRADIENTS;