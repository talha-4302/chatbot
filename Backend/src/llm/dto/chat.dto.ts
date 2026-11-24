import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ChatResult, MODELS, Role } from '../llm.service';

export class MessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: Role;

  @ApiProperty({ example: 'Hi' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ChatRequestDto {
  @ApiProperty({ type: () => [MessageDto], description: 'Full history, oldest first. Must end with a user message.' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ApiPropertyOptional({ example: 'Be concise.' })
  @IsOptional()
  @IsString()
  system?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number;

  @ApiPropertyOptional({ enum: MODELS, description: 'Defaults to LLM_MODEL' })
  @IsOptional()
  @IsIn(MODELS)
  model?: string;
}

// Class form of ChatResult so Swagger can describe the response.
export class ChatResultDto implements ChatResult {
  @ApiProperty() reply: string;
  @ApiProperty() model: string;
  @ApiProperty({ nullable: true, type: String, example: 'stop' }) stopReason: string | null;
  @ApiProperty({ nullable: true, example: { inputTokens: 7, outputTokens: 5 } }) usage: { inputTokens: number; outputTokens: number } | null;
  @ApiProperty() latencyMs: number;
  @ApiProperty() mock: boolean;
}
