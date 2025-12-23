import OpenAI from 'openai';

export class OpenAIService {
  private client: OpenAI | null = null;

  initialize(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.models.list();
      return true;
    } catch (e) {
      console.error('OpenAI Connection Failed:', e);
      return false;
    }
  }

  async generateCompletion(
    model: string,
    systemPrompt: string,
    userContent: string,
    jsonMode: boolean = true
  ): Promise<any> {
    if (!this.client) throw new Error('OpenAI client not initialized');

    const startTime = Date.now();
    console.log(`[OpenAI] Calling ${model} (prompt: ${userContent.length} chars)...`);

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        response_format: jsonMode ? { type: 'json_object' } : { type: 'text' }
      });

      const elapsed = Date.now() - startTime;
      const content = completion.choices[0].message.content;
      const usage = completion.usage;
      
      console.log(`[OpenAI] Response received in ${elapsed}ms (tokens: ${usage?.total_tokens || 'N/A'})`);
      
      if (!content) throw new Error('Empty response from OpenAI');

      return jsonMode ? JSON.parse(content) : content;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[OpenAI] Error after ${elapsed}ms:`, error.message);
      throw error;
    }
  }
}

export const openAIService = new OpenAIService();
