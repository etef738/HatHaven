# Heart & Playground - AI Companion & Dating Training App

## Overview

Heart & Playground is an AI-powered companion and dating training web application designed for adults 18+. The app features two primary modes: Heart Mode for emotional AI companionship with memory capabilities, and Dating Training Mode for practicing dating scenarios with performance feedback. Built with a modern full-stack architecture, it combines React frontend with Express/Node.js backend, PostgreSQL database with vector embeddings for AI memory, and a comprehensive multi-agent AI system for intelligent conversation handling.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite build system
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system and CSS variables
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state and custom auth context
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database ORM**: Drizzle ORM with PostgreSQL and pgvector extension
- **Authentication**: Passport.js with session-based auth using express-session
- **AI Integration**: OpenAI GPT-5 for chat completions and text-embedding-3-large for vector embeddings
- **Multi-Agent System**: Comprehensive agent architecture with specialized roles:
  - SupervisorAgent: Routes requests to appropriate agents
  - PersonaStylist: Maintains AI companion personality
  - MemoryManager: Handles conversation memory with vector search
  - SafetyGuardian: Content filtering and safety checks
  - DatingCoach: Provides dating advice and feedback
  - ConversationAnalyzer: Performance scoring system
  - ScenarioDirector: Manages dating practice scenarios
  - Additional specialized agents for analytics, billing, and security

### Data Storage Architecture
- **Primary Database**: PostgreSQL with pgvector extension for similarity search
- **Session Storage**: PostgreSQL-backed session store
- **Schema Design**:
  - Users table with subscription tiers and age verification
  - Conversations table with mode tracking and vector embeddings
  - Performance scores with detailed feedback JSON
  - User memories with importance scoring and vector embeddings
- **Vector Search**: Cosine similarity for memory recall and conversation context

### Authentication & Security
- **Session Management**: Express-session with PostgreSQL store
- **Password Security**: Scrypt hashing with random salts
- **Age Verification**: Required 18+ age check during registration
- **Content Safety**: Multi-layer filtering through SafetyGuardian agent
- **Red Team Testing**: Automated security vulnerability testing

### AI Architecture
- **Model Selection**: GPT-5 for conversations, text-embedding-3-large for embeddings
- **Memory System**: Short-term (conversation history) and long-term (vector-stored memories)
- **Performance Scoring**: Multi-dimensional analysis (engagement, empathy, flow)
- **Scenario Management**: Structured dating practice scenarios with objectives
- **Safety Filtering**: AI-powered content moderation with risk assessment

## External Dependencies

### Core Infrastructure
- **Database**: PostgreSQL with pgvector extension (configured for Neon Database)
- **AI Services**: OpenAI API for chat completions and embeddings
- **Session Store**: PostgreSQL-backed session storage

### Third-Party Libraries
- **Frontend**: React ecosystem with Shadcn/ui, TanStack Query, Wouter router
- **Backend**: Express.js, Passport.js authentication, Drizzle ORM
- **UI Components**: Radix UI primitives for accessible component foundation
- **Charts & Visualization**: Recharts for performance analytics display
- **Development Tools**: Vite, TypeScript, Tailwind CSS, ESBuild for production builds

### Development & Deployment
- **Build System**: Vite for frontend, ESBuild for backend bundling
- **Type Safety**: Full TypeScript implementation with shared schemas
- **Environment**: Designed for Replit deployment with attached assets and configuration
- **Package Management**: NPM with lockfile for consistent dependencies