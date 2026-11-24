import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { ChatController } from './chat.controller';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { TaskToolRunner } from './tools/task-tools';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  providers: [LlmService, AgentService, TaskToolRunner],
  controllers: [ChatController, AgentController],
  exports: [LlmService],
})
export class LlmModule {}
