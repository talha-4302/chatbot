import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { ChatRequestDto, ChatResultDto } from './dto/chat.dto';
import { ChatResult, LlmService } from './llm.service';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly llm: LlmService) {}

  @ApiOperation({ summary: 'List selectable models and the default' })
  @Get('models')
  models() {
    return this.llm.models();
  }

  @ApiOperation({ summary: 'Send the full conversation, get the next reply' })
  @ApiCreatedResponse({ type: ChatResultDto })
  @ApiBadRequestResponse({ description: 'Invalid body, or last message is not from the user' })
  @ApiServiceUnavailableResponse({ description: 'LLM rate limited, busy or timed out' })
  @Post()
  chat(@Body() dto: ChatRequestDto): Promise<ChatResult> {
    // The API expects the conversation to end on a user turn.
    if (dto.messages[dto.messages.length - 1].role !== 'user') {
      throw new BadRequestException('Last message must have role "user"');
    }
    return this.llm.chat(dto.messages, dto.system, dto.temperature, dto.model);
  }
}
