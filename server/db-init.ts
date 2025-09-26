/**
 * Database Initialization and Index Management
 * Ensures pgvector extension and all indexes are properly applied at runtime
 */

import { Pool } from '@neondatabase/serverless';
import { pool } from './db';

interface IndexDefinition {
  name: string;
  sql: string;
  description: string;
}

// Define all indexes that need to be created at runtime
const REQUIRED_INDEXES: IndexDefinition[] = [
  // Conversations table indexes
  {
    name: 'idx_conversations_user_timestamp',
    sql: 'CREATE INDEX IF NOT EXISTS idx_conversations_user_timestamp ON conversations (user_id, timestamp DESC)',
    description: 'User conversations by timestamp for performance'
  },
  {
    name: 'idx_conversations_mode',
    sql: 'CREATE INDEX IF NOT EXISTS idx_conversations_mode ON conversations (mode)',
    description: 'Conversations by mode filtering'
  },
  {
    name: 'idx_conversations_embedding',
    sql: 'CREATE INDEX IF NOT EXISTS idx_conversations_embedding ON conversations USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)',
    description: 'Vector similarity search on conversation embeddings'
  },
  
  // User memories table indexes
  {
    name: 'idx_memories_user_importance',
    sql: 'CREATE INDEX IF NOT EXISTS idx_memories_user_importance ON user_memories (user_id, importance DESC, created_at DESC)',
    description: 'User memories by importance and recency'
  },
  {
    name: 'idx_memories_embedding',
    sql: 'CREATE INDEX IF NOT EXISTS idx_memories_embedding ON user_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)',
    description: 'Vector similarity search on memory embeddings'
  },
  
  // Voice sessions table indexes
  {
    name: 'idx_voice_sessions_user_created',
    sql: 'CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_created ON voice_sessions (user_id, created_at DESC)',
    description: 'Voice sessions by user and creation time'
  },
  {
    name: 'idx_voice_sessions_conversation',
    sql: 'CREATE INDEX IF NOT EXISTS idx_voice_sessions_conversation ON voice_sessions (conversation_id)',
    description: 'Voice sessions by conversation for linking'
  },
  {
    name: 'idx_voice_sessions_embedding',
    sql: 'CREATE INDEX IF NOT EXISTS idx_voice_sessions_embedding ON voice_sessions USING ivfflat (transcript_embedding vector_cosine_ops) WITH (lists = 50)',
    description: 'Vector similarity search on voice transcript embeddings'
  },
  
  // Voice analytics table indexes
  {
    name: 'idx_voice_analytics_user_created',
    sql: 'CREATE INDEX IF NOT EXISTS idx_voice_analytics_user_created ON voice_analytics (user_id, created_at DESC)',
    description: 'Voice analytics by user and time for dashboards'
  },
  {
    name: 'idx_voice_analytics_created',
    sql: 'CREATE INDEX IF NOT EXISTS idx_voice_analytics_created ON voice_analytics (created_at DESC)',
    description: 'Voice analytics by time for system monitoring'
  },
  {
    name: 'idx_voice_analytics_latency',
    sql: 'CREATE INDEX IF NOT EXISTS idx_voice_analytics_latency ON voice_analytics (processing_latency_ms, created_at DESC)',
    description: 'Performance analysis index on latency metrics'
  },
  {
    name: 'idx_voice_analytics_errors',
    sql: 'CREATE INDEX IF NOT EXISTS idx_voice_analytics_errors ON voice_analytics (error_details, created_at DESC) WHERE error_details IS NOT NULL',
    description: 'Error analysis index for debugging and monitoring'
  }
];

/**
 * Initialize database with required extensions and indexes
 */
export async function initializeDatabase(): Promise<void> {
  console.log('🔧 Initializing database extensions and indexes...');
  
  try {
    // Step 1: Ensure pgvector extension is enabled
    console.log('📐 Enabling pgvector extension...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('✅ pgvector extension enabled');
    
    // Step 2: Create all required indexes
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const index of REQUIRED_INDEXES) {
      try {
        console.log(`📋 Creating index: ${index.name} - ${index.description}`);
        
        // Execute the index creation SQL
        await pool.query(index.sql);
        createdCount++;
        
        console.log(`✅ Index ${index.name} ready`);
      } catch (error) {
        // Check if error is due to index already existing or other issue
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('already exists')) {
          console.log(`⏭️  Index ${index.name} already exists, skipping`);
          skippedCount++;
        } else {
          console.warn(`⚠️  Failed to create index ${index.name}:`, errorMessage);
          // Don't throw - continue with other indexes
        }
      }
    }
    
    // Step 3: Analyze indexes for optimal performance
    console.log('🔍 Running ANALYZE to update index statistics...');
    await pool.query('ANALYZE');
    console.log('✅ Database analysis complete');
    
    console.log(`🎉 Database initialization complete:`);
    console.log(`   - Indexes created/verified: ${createdCount + skippedCount}`);
    console.log(`   - New indexes: ${createdCount}`);
    console.log(`   - Existing indexes: ${skippedCount}`);
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw new Error(`Database initialization failed: ${(error as Error).message}`);
  }
}

/**
 * Check if all required indexes exist
 */
export async function validateIndexes(): Promise<boolean> {
  try {
    console.log('🔍 Validating database indexes...');
    
    // Query to check if all indexes exist
    const result = await pool.query(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
        AND indexname IN (${REQUIRED_INDEXES.map((_, i) => `$${i + 1}`).join(', ')})
    `, REQUIRED_INDEXES.map(idx => idx.name));
    
    const existingIndexes = new Set(result.rows.map(row => row.indexname));
    const missingIndexes = REQUIRED_INDEXES.filter(idx => !existingIndexes.has(idx.name));
    
    if (missingIndexes.length > 0) {
      console.warn('⚠️  Missing indexes:', missingIndexes.map(idx => idx.name));
      return false;
    }
    
    console.log('✅ All required indexes are present');
    return true;
  } catch (error) {
    console.error('❌ Index validation failed:', error);
    return false;
  }
}

/**
 * Get database performance metrics for monitoring
 */
export async function getDatabaseMetrics(): Promise<{
  totalIndexes: number;
  vectorIndexes: number;
  indexSizes: Array<{ indexName: string; size: string }>;
}> {
  try {
    const indexSizeQuery = `
      SELECT 
        indexname as "indexName",
        pg_size_pretty(pg_relation_size(indexname::regclass)) as "size"
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname LIKE ANY(ARRAY['%embedding%', '%vector%', '%idx_%'])
      ORDER BY pg_relation_size(indexname::regclass) DESC
    `;
    
    const sizeResult = await pool.query(indexSizeQuery);
    
    // Count total and vector-specific indexes
    const allIndexesQuery = `
      SELECT COUNT(*) as total
      FROM pg_indexes 
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
    `;
    
    const vectorIndexesQuery = `
      SELECT COUNT(*) as vector_count
      FROM pg_indexes 
      WHERE schemaname = 'public'
        AND indexname LIKE '%embedding%'
    `;
    
    const [totalResult, vectorResult] = await Promise.all([
      pool.query(allIndexesQuery),
      pool.query(vectorIndexesQuery)
    ]);
    
    return {
      totalIndexes: parseInt(totalResult.rows[0].total),
      vectorIndexes: parseInt(vectorResult.rows[0].vector_count),
      indexSizes: sizeResult.rows
    };
  } catch (error) {
    console.error('Failed to get database metrics:', error);
    return {
      totalIndexes: 0,
      vectorIndexes: 0,
      indexSizes: []
    };
  }
}