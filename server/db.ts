import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { initializeDatabase } from "./db-init";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Initialize database indexes and extensions on first connection
let isInitialized = false;

export async function ensureDatabaseReady(): Promise<void> {
  if (!isInitialized) {
    try {
      await initializeDatabase();
      isInitialized = true;
      console.log('✅ Database initialization completed successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      // Don't throw - allow app to start but log the issue
      console.warn('⚠️  App starting without optimized database indexes');
    }
  }
}
