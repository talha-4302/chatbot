import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { ChatController } from './chat.controller';

@Module({
  providers: [LlmService],
  controllers: [ChatController],
  exports: [LlmService],
})
export class LlmModule {}
