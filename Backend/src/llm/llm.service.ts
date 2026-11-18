import { Injectable, Logger, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Role = 'user' | 'assistant';
export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatResult {
  reply: string;
  model: string;
  stopReason: string | null; // 'end_turn' | 'max_tokens' | ...
  usage: { inputTokens: number; outputTokens: number } | null; // null in mock mode
  latencyMs: number;
  mock: boolean;
}

const PLACEHOLDER = 'your-api-key-here';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('LLM_API_KEY');
    this.model = config.get<string>('LLM_MODEL', 'gemini-3.8-flash');
    this.maxTokens = Number(config.get('LLM_MAX_TOKENS', 2048));

    // No real key → mock mode, so the frontend can be wired up today.
    this.apiKey = apiKey && apiKey !== PLACEHOLDER ? apiKey : null;
    if (!this.apiKey) this.logger.warn('No API key set — running in MOCK mode.');
  }

  /**
   * Stateless by design: the caller passes the FULL history every time.
   * The model holds nothing between calls.
   */
  async chat(messages: ChatMessage[], system?: string, temperature?: number): Promise<ChatResult> {
    const started = Date.now();

    if (!this.apiKey) return this.mockReply(messages, started);

    // Gemini REST via built-in fetch (no SDK). Roles are 'user' | 'model'.
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        ...(system && { systemInstruction: { parts: [{ text: system }] } }),
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          ...(temperature !== undefined && { temperature }),
        },
      }),
    });

    if (!res.ok) {
      this.logger.error(`LLM API error ${res.status}: ${await res.text()}`);
      throw res.status === 429
        ? new ServiceUnavailableException('LLM rate limited, retry shortly')
        : new BadGatewayException('LLM provider error');
    }

    const data: any = await res.json();
    const cand = data.candidates?.[0];
    const reply = (cand?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
    const u = data.usageMetadata;
    const result: ChatResult = {
      reply,
      model: data.modelVersion ?? this.model,
      stopReason: cand?.finishReason ?? null,
      usage: u ? { inputTokens: u.promptTokenCount ?? 0, outputTokens: u.candidatesTokenCount ?? 0 } : null,
      latencyMs: Date.now() - started,
      mock: false,
    };

    this.logger.log(`in=${result.usage?.inputTokens} out=${result.usage?.outputTokens} stop=${result.stopReason} ${result.latencyMs}ms`);
    if (result.stopReason === 'MAX_TOKENS') this.logger.warn('Reply was truncated by max_tokens');
    return result;
  }

  private mockReply(messages: ChatMessage[], started: number): ChatResult {
    const last = messages[messages.length - 1]?.content ?? '';
    return {
      reply: `[mock] You said: "${last}". (${messages.length} messages in history)`,
      model: 'mock',
      stopReason: 'end_turn',
      usage: null, // no fake token counts
      latencyMs: Date.now() - started,
      mock: true,
    };
  }
}
