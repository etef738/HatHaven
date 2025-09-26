import OpenAI, { toFile } from "openai";
import { faultInjector } from "./chaos-testing/fault-injector";

// Using gpt-4-turbo for reliable performance
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function createEmbedding(text: string): Promise<number[]> {
  // Wrap the original function with fault injection
  const wrappedFunction = faultInjector.wrapWithFaultInjection(
    'openai_embedding',
    'create_embedding',
    async () => {
      try {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-large",
          input: text,
          dimensions: 1536,
        });
        return response.data[0].embedding;
      } catch (error) {
        console.error('Error creating embedding:', error);
        throw new Error('Failed to create embedding');
      }
    }
  );
  
  return await wrappedFunction();
}

export async function generateChatResponse(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<string> {
  // Wrap the original function with fault injection
  const wrappedFunction = faultInjector.wrapWithFaultInjection(
    'openai_llm',
    'chat_completion',
    async () => {
      try {
        const allMessages = systemPrompt 
          ? [{ role: "system", content: systemPrompt }, ...messages]
          : messages;

        const response = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          messages: allMessages as any,
          temperature: 0.7,
          max_tokens: 1000,
        });

        return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
      } catch (error) {
        console.error('Error generating chat response:', error);
        throw new Error('Failed to generate response');
      }
    }
  );
  
  return await wrappedFunction();
}

export async function* generateStreamingChatResponse(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): AsyncGenerator<string, void, unknown> {
  try {
    const allMessages = systemPrompt 
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages;

    const stream = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: allMessages as any,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    console.error('Error generating streaming chat response:', error);
    throw new Error('Failed to generate streaming response');
  }
}

export async function generateStructuredResponse<T>(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<T> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "system", content: systemPrompt }, ...messages] as any,
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content in response');
    }

    return JSON.parse(content) as T;
  } catch (error) {
    console.error('Error generating structured response:', error);
    throw new Error('Failed to generate structured response');
  }
}

// Audio transcription using Whisper with fault injection
export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<{ text: string; duration?: number }> {
  // Wrap the original function with fault injection
  const wrappedFunction = faultInjector.wrapWithFaultInjection(
    'openai_stt',
    'transcribe',
    async () => {
      try {
        // Use OpenAI's toFile utility for proper Node.js compatibility
        const file = await toFile(audioBuffer, filename, { type: 'audio/webm' });
        
        const transcription = await openai.audio.transcriptions.create({
          file: file,
          model: "whisper-1",
          language: "en", // Can be made configurable
          response_format: "json"
        });

        return {
          text: transcription.text,
          duration: 0, // Duration not available in current OpenAI API response
        };
      } catch (error) {
        console.error('Error transcribing audio:', error);
        throw new Error('Failed to transcribe audio');
      }
    }
  );
  
  return await wrappedFunction();
}

// Text-to-speech using OpenAI TTS with fault injection
export async function generateSpeech(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'): Promise<Buffer> {
  // Wrap the original function with fault injection
  const wrappedFunction = faultInjector.wrapWithFaultInjection(
    'openai_tts',
    'generate_speech',
    async () => {
      try {
        const response = await openai.audio.speech.create({
          model: "tts-1",
          voice: voice,
          input: text,
          response_format: "mp3",
          speed: 1.0
        });

        // Convert response to Buffer
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        console.error('Error generating speech:', error);
        throw new Error('Failed to generate speech');
      }
    }
  );
  
  return await wrappedFunction();
}

export { openai };
