import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ChatRequestDto } from './dto/chat.dto';
import { ChatResult, LlmService } from './llm.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly llm: LlmService) {}

  @Get('models')
  models() {
    return this.llm.models();
  }

  @Post()
  chat(@Body() dto: ChatRequestDto): Promise<ChatResult> {
    // The API expects the conversation to end on a user turn.
    if (dto.messages[dto.messages.length - 1].role !== 'user') {
      throw new BadRequestException('Last message must have role "user"');
    }
    return this.llm.chat(dto.messages, dto.system, dto.temperature, dto.model);
  }
}
