import { ApiProperty } from '@nestjs/swagger';
import { AgentResult, AgentStep } from '../agent.service';

// Class forms so Swagger can describe the /agent response.
export class AgentStepDto implements AgentStep {
  @ApiProperty() step: number;
  @ApiProperty({ example: 'tool-calls' }) finishReason: string;
  @ApiProperty({ example: { inputTokens: 310, outputTokens: 22 } }) usage: { inputTokens: number; outputTokens: number };
  @ApiProperty({
    example: [{ id: 'call_1', name: 'search_tasks', input: { query: 'bank', includeDone: false }, ok: true, output: [], ms: 1 }],
  })
  toolCalls: AgentStep['toolCalls'];
}

export class AgentResultDto implements AgentResult {
  @ApiProperty() reply: string;
  @ApiProperty() model: string;
  @ApiProperty({ example: 'stop' }) stopReason: string;
  @ApiProperty({ type: () => [AgentStepDto] }) steps: AgentStepDto[];
  @ApiProperty({ nullable: true, example: { inputTokens: 700, outputTokens: 60 } }) usage: { inputTokens: number; outputTokens: number } | null;
  @ApiProperty() latencyMs: number;
  @ApiProperty() mock: boolean;
}
