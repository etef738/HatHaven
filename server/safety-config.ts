// Comprehensive safety configuration for HeartScene
export interface SafetyPolicy {
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  keywords: string[];
  patterns: RegExp[];
  escalate: boolean;
  autoBlock: boolean;
  description: string;
}

export const SAFETY_POLICIES: SafetyPolicy[] = [
  // Sexual Content Policies
  {
    category: "explicit_sexual_content",
    riskLevel: "critical",
    keywords: [
      "explicit", "graphic", "hardcore", "pornographic", "xxx", "nsfw",
      "nude", "naked", "genitals", "penis", "vagina", "breast", "nipple",
      "masturbation", "orgasm", "climax", "ejaculation", "penetration",
      "anal", "oral sex", "blowjob", "cunnilingus", "fellatio", "69",
      "threesome", "orgy", "gangbang", "bdsm", "bondage", "fetish",
      "kink", "dominatrix", "submissive", "whip", "handcuffs", "sex toy",
      "dildo", "vibrator", "escort", "prostitute", "hooker", "strip",
      "stripper", "webcam", "cam girl", "onlyfans", "porn", "sexual",
      "erotic", "horny", "aroused", "turned on", "wet", "hard", "cum"
    ],
    patterns: [
      /\b(f+u+c+k|s+e+x)\b/i,
      /\b(dick|cock|pussy|ass|tits|boobs)\b/i,
      /\b(make love|hook up|one night stand)\b/i,
      /\b(send nudes|pics|photos)\b/i
    ],
    escalate: true,
    autoBlock: true,
    description: "Explicit sexual content that violates platform policies"
  },
  
  // Violence and Self-Harm
  {
    category: "violence_self_harm",
    riskLevel: "critical",
    keywords: [
      "kill", "murder", "suicide", "self-harm", "cut", "cutting", "razor",
      "blade", "hurt", "pain", "blood", "die", "death", "violence",
      "violent", "abuse", "assault", "attack", "fight", "punch", "hit",
      "beat", "torture", "weapon", "gun", "knife", "bomb", "terrorist",
      "terrorism", "threat", "threatening", "stab", "shoot", "choke",
      "strangle", "poison", "overdose", "hanging", "jump", "bridge"
    ],
    patterns: [
      /\b(want to die|kill myself|end it all|not worth living)\b/i,
      /\b(hurt you|kill you|destroy you)\b/i,
      /\b(cut myself|harm myself|hate myself)\b/i
    ],
    escalate: true,
    autoBlock: true,
    description: "Content promoting violence or self-harm"
  },
  
  // Harassment and Bullying
  {
    category: "harassment_bullying",
    riskLevel: "high",
    keywords: [
      "ugly", "fat", "stupid", "worthless", "pathetic", "loser", "idiot",
      "freak", "creep", "stalker", "harassment", "bully", "bullying",
      "intimidate", "threaten", "blackmail", "doxx", "revenge", "humiliate",
      "embarrass", "shame", "ridicule", "mock", "tease", "torment"
    ],
    patterns: [
      /\b(you are (so )?(ugly|fat|stupid|worthless))\b/i,
      /\b(nobody likes you|everyone hates you)\b/i,
      /\b(follow you home|know where you live)\b/i
    ],
    escalate: true,
    autoBlock: true,
    description: "Harassment, bullying, or intimidating behavior"
  },
  
  // Hate Speech and Discrimination
  {
    category: "hate_speech",
    riskLevel: "critical",
    keywords: [
      "hate", "racist", "racism", "sexist", "sexism", "homophobic",
      "transphobic", "xenophobic", "bigot", "discrimination", "slur",
      "nazi", "supremacist", "inferior", "subhuman", "derogatory"
    ],
    patterns: [
      /\b(all (women|men|blacks|whites|jews|muslims|christians|gays|trans) are)\b/i,
      /\b(go back to|your kind|those people)\b/i
    ],
    escalate: true,
    autoBlock: true,
    description: "Hate speech or discriminatory content"
  },
  
  // Personal Information Sharing
  {
    category: "personal_information",
    riskLevel: "high",
    keywords: [
      "address", "phone number", "social security", "credit card", "bank",
      "password", "location", "home", "work", "school", "full name",
      "email", "instagram", "facebook", "twitter", "snapchat", "tiktok"
    ],
    patterns: [
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone numbers
      /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/, // Credit card numbers
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d+\s+[A-Za-z\s]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr)\b/i // Addresses
    ],
    escalate: true,
    autoBlock: false, // Sometimes legitimate in dating context
    description: "Potential personal information sharing"
  },
  
  // Illegal Activities
  {
    category: "illegal_activities",
    riskLevel: "critical",
    keywords: [
      "drugs", "cocaine", "heroin", "meth", "marijuana", "weed", "dealer",
      "selling", "buying", "illegal", "crime", "criminal", "steal",
      "theft", "robbery", "fraud", "scam", "counterfeit", "fake ID",
      "hack", "hacking", "piracy", "copyright", "underage", "minor"
    ],
    patterns: [
      /\b(buy drugs|sell drugs|drug dealer)\b/i,
      /\b(steal from|rob a|commit (crime|fraud))\b/i,
      /\b(hack into|break into|illegal download)\b/i
    ],
    escalate: true,
    autoBlock: true,
    description: "Content related to illegal activities"
  },
  
  // Inappropriate Age Content
  {
    category: "age_inappropriate",
    riskLevel: "critical",
    keywords: [
      "minor", "child", "kid", "teenager", "teen", "underage", "school",
      "high school", "middle school", "elementary", "young", "baby",
      "infant", "toddler", "preteen", "adolescent", "juvenile"
    ],
    patterns: [
      /\b(I am \d{1,2}|I'm \d{1,2})\b/i,
      /\b(\d{1,2} years old)\b/i,
      /\b(still in school|high school student)\b/i
    ],
    escalate: true,
    autoBlock: true,
    description: "Content inappropriate for age-restricted platform"
  },
  
  // Spam and Commercial Content
  {
    category: "spam_commercial",
    riskLevel: "medium",
    keywords: [
      "buy now", "click here", "limited time", "offer", "discount",
      "free money", "make money", "investment", "crypto", "bitcoin",
      "nft", "pyramid", "mlm", "affiliate", "referral", "commission"
    ],
    patterns: [
      /\b(visit (my|our) website|check out my profile)\b/i,
      /\b(make \$\d+|earn money fast)\b/i,
      /\b(click (this )?link|go to)\b/i
    ],
    escalate: false,
    autoBlock: false,
    description: "Potential spam or unwanted commercial content"
  },
  
  // Mental Health Crisis
  {
    category: "mental_health_crisis",
    riskLevel: "critical",
    keywords: [
      "depression", "anxiety", "panic", "crisis", "emergency", "help",
      "therapist", "therapy", "counseling", "medication", "pills",
      "mental health", "breakdown", "episode", "trigger", "trauma"
    ],
    patterns: [
      /\b(need help|feeling hopeless|can't go on)\b/i,
      /\b(having thoughts|intrusive thoughts)\b/i,
      /\b(crisis|emergency|urgent)\b/i
    ],
    escalate: true,
    autoBlock: false, // Don't block, but provide resources
    description: "Content indicating potential mental health crisis"
  }
];

// Safety response templates
export const SAFETY_RESPONSES: Record<string, string> = {
  explicit_sexual_content: "I'm designed to have meaningful conversations while keeping things appropriate. Let's talk about something else that interests you.",
  violence_self_harm: "I'm concerned about what you've shared. If you're having thoughts of self-harm, please reach out to a crisis helpline: 988 (Suicide & Crisis Lifeline). Let's talk about something positive.",
  harassment_bullying: "I don't engage with content that could be hurtful to others. Let's keep our conversation respectful and supportive.",
  hate_speech: "I'm committed to respectful conversations for everyone. Let's focus on something positive we can discuss together.",
  personal_information: "For your safety, I'd recommend not sharing personal details online. Let's continue our conversation without specific personal information.",
  illegal_activities: "I can't assist with or discuss illegal activities. Let's talk about something positive and constructive instead.",
  age_inappropriate: "This platform is designed for adults 18 and older. If you're under 18, please use age-appropriate services.",
  spam_commercial: "I'm here for genuine conversation, not commercial activities. What would you like to chat about?",
  mental_health_crisis: "Thank you for sharing. While I'm here to chat, for serious mental health support, please contact a professional. Crisis helpline: 988. What positive topics would you like to explore together?",
  general: "I'm sorry, but I can't respond to that. Let's keep our conversation positive and supportive. What else would you like to talk about?"
};

// Mental health resources
export const MENTAL_HEALTH_RESOURCES = {
  crisis_hotlines: [
    { name: "988 Suicide & Crisis Lifeline", number: "988", available: "24/7" },
    { name: "Crisis Text Line", number: "Text HOME to 741741", available: "24/7" },
    { name: "National Domestic Violence Hotline", number: "1-800-799-7233", available: "24/7" },
    { name: "RAINN National Sexual Assault Hotline", number: "1-800-656-4673", available: "24/7" }
  ],
  online_resources: [
    "National Alliance on Mental Illness (NAMI): nami.org",
    "Mental Health America: mha.org",
    "Crisis Text Line: crisistextline.org",
    "BetterHelp: betterhelp.com"
  ]
};