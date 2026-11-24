import { Injectable, Logger, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APICallError, RetryError, generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export type Role = 'user' | 'assistant';
export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatResult {
  reply: string;
  model: string;
  stopReason: string | null; // 'stop' | 'length' | ...
  usage: { inputTokens: number; outputTokens: number } | null; // null in mock mode
  latencyMs: number;
  mock: boolean;
}

// Allowlist: only these model names are accepted from clients.
export const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.8-flash'];

const PLACEHOLDER = 'your-api-key-here';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly google: ReturnType<typeof createGoogleGenerativeAI> | null;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('LLM_API_KEY');
    this.model = config.get<string>('LLM_MODEL', 'gemini-3.5-flash-lite');
    this.maxTokens = Number(config.get('LLM_MAX_TOKENS', 2048));

    // No real key → mock mode, so the frontend can be wired up today.
    this.google = apiKey && apiKey !== PLACEHOLDER ? createGoogleGenerativeAI({ apiKey }) : null;
    if (!this.google) this.logger.warn('No API key set — running in MOCK mode.');
  }

  /**
   * Stateless by design: the caller passes the FULL history every time.
   * The model holds nothing between calls.
   * Provider-specific code lives only here: to switch provider, change the imports and the model call.
   */
  async chat(messages: ChatMessage[], system?: string, temperature?: number, model = this.model): Promise<ChatResult> {
    const started = Date.now();

    if (!this.google) return this.mockReply(messages, started);

    try {
      const res = await generateText({
        model: this.google(model),
        system,
        messages, // the SDK maps 'assistant' to Gemini's 'model' role for us
        maxOutputTokens: this.maxTokens,
        temperature,
        abortSignal: AbortSignal.timeout(30_000), // covers retries too: never hang the client
      });

      const result: ChatResult = {
        reply: res.text,
        model: res.response.modelId ?? model,
        stopReason: res.finishReason ?? null,
        usage: { inputTokens: res.usage.inputTokens ?? 0, outputTokens: res.usage.outputTokens ?? 0 },
        latencyMs: Date.now() - started,
        mock: false,
      };

      this.logger.log(`in=${result.usage?.inputTokens} out=${result.usage?.outputTokens} stop=${result.stopReason} ${result.latencyMs}ms`);
      if (result.stopReason === 'length') this.logger.warn('Reply was truncated by max_tokens');
      return result;
    } catch (err) {
      // After retries the SDK wraps the real error in RetryError.
      const cause = RetryError.isInstance(err) ? err.lastError : err;
      const status = APICallError.isInstance(cause) ? cause.statusCode : undefined;
      this.logger.error(`LLM call failed (${status ?? 'no status'}): ${(cause as Error).message}`);

      const name = (cause as Error).name;
      const transient = status === 429 || status === 503 || name === 'TimeoutError' || name === 'AbortError';
      if (transient) throw new ServiceUnavailableException('LLM busy or timed out, retry shortly');
      if (APICallError.isInstance(cause)) throw new BadGatewayException('LLM provider error');
      throw err;
    }
  }

  models() {
    return { models: [...new Set([this.model, ...MODELS])], default: this.model };
  }

  private mockReply(messages: ChatMessage[], started: number): ChatResult {
    const last = messages[messages.length - 1]?.content ?? '';
    return {
      reply: `[mock] You said: "${last}". (${messages.length} messages in history)`,
      model: 'mock',
      stopReason: 'stop',
      usage: null, // no fake token counts
      latencyMs: Date.now() - started,
      mock: true,
    };
  }
}
