import { Injectable, NotFoundException } from '@nestjs/common';

export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: number;
  userId: string;
  title: string;
  priority: Priority;
  dueDate: string | null;
  done: boolean;
}

/**
 * Plain domain service. It knows nothing about LLMs: the tools call it,
 * exactly like a controller would. In-memory, so data resets on restart.
 */
@Injectable()
export class TasksService {
  private nextId = 1;
  private readonly tasks: Task[] = [];

  constructor() {
    // Demo data for the default user.
    this.create('demo', { title: 'Call the bank', priority: 'high', dueDate: null });
    this.create('demo', { title: 'Renew passport', priority: 'medium', dueDate: null });
  }

  /** Every method takes userId: a user only ever sees their own tasks. */
  search(userId: string, query: string | null, includeDone: boolean): Task[] {
    const q = query?.toLowerCase();
    return this.tasks
      .filter((t) => t.userId === userId)
      .filter((t) => includeDone || !t.done)
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .slice(0, 10); // keep tool output small: it is paid for on every later step
  }

  create(userId: string, input: { title: string; priority: Priority; dueDate: string | null }): Task {
    const task: Task = { id: this.nextId++, userId, ...input, done: false };
    this.tasks.push(task);
    return task;
  }

  complete(userId: string, id: number): Task {
    const task = this.tasks.find((t) => t.id === id && t.userId === userId);
    if (!task) throw new NotFoundException(`No task with id ${id}`);
    task.done = true;
    return task;
  }
}
