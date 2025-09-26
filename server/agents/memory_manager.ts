import { createEmbedding } from "../openai";
import { storage } from "../storage";
import { InsertUserMemory } from "@shared/schema";

export class MemoryManager {
  async storeMemory(
    userId: string,
    content: string,
    importance: number = 5
  ): Promise<void> {
    try {
      const embedding = await createEmbedding(content);
      
      await storage.createUserMemory({
        userId,
        content,
        embedding,
        importance,
      });
    } catch (error) {
      console.error('Error storing memory:', error);
      throw new Error('Failed to store memory');
    }
  }

  async recallRelevantMemories(
    userId: string,
    query: string,
    limit: number = 5
  ): Promise<string[]> {
    try {
      const queryEmbedding = await createEmbedding(query);
      const memories = await storage.searchSimilarMemories(userId, queryEmbedding, limit);
      
      return memories.map(memory => memory.content);
    } catch (error) {
      console.error('Error recalling memories:', error);
      return [];
    }
  }

  async extractImportantMoments(conversationContent: any[]): Promise<string[]> {
    const importantMoments: string[] = [];
    
    // Simple heuristics for now - can be enhanced with AI analysis
    for (const message of conversationContent) {
      if (message.role === 'user') {
        const content = message.content.toLowerCase();
        
        // Look for emotional indicators, personal information, preferences
        if (
          content.includes('i feel') ||
          content.includes('i love') ||
          content.includes('i hate') ||
          content.includes('my family') ||
          content.includes('my job') ||
          content.includes('i want') ||
          content.includes('i dream') ||
          content.length > 100 // Longer messages often contain more important info
        ) {
          importantMoments.push(message.content);
        }
      }
    }
    
    return importantMoments;
  }
}
