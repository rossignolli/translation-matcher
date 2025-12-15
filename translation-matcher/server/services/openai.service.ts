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

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        response_format: jsonMode ? { type: 'json_object' } : { type: 'text' }
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error('Empty response from OpenAI');

      return jsonMode ? JSON.parse(content) : content;
    } catch (error) {
      console.error('GPT Generation Error:', error);
      throw error;
    }
  }
}

export const openAIService = new OpenAIService();
