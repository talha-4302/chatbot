import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiHeader, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { ChatRequestDto } from './dto/chat.dto';
import { AgentResultDto } from './dto/agent.dto';
import { AgentResult, AgentService } from './agent.service';

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @ApiOperation({ summary: 'Chat with tool use: the model can search, create and complete tasks' })
  @ApiHeader({ name: 'x-user-id', required: false, description: 'Stand-in for real auth. Defaults to "demo".' })
  @ApiCreatedResponse({ type: AgentResultDto })
  @ApiBadRequestResponse({ description: 'Invalid body, or last message is not from the user' })
  @ApiServiceUnavailableResponse({ description: 'LLM rate limited, busy or timed out' })
  @Post()
  run(@Body() dto: ChatRequestDto, @Headers('x-user-id') userId?: string): Promise<AgentResult> {
    if (dto.messages[dto.messages.length - 1].role !== 'user') {
      throw new BadRequestException('Last message must have role "user"');
    }
    // TODO(auth): take the user from a verified session/JWT, not a header.
    const ctx = { userId: userId?.trim() || 'demo' };
    return this.agent.run(dto.messages, ctx, { model: dto.model, temperature: dto.temperature, system: dto.system });
  }
}
