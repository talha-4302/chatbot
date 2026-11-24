import { Injectable, Logger } from '@nestjs/common';
import { tool, type ToolResultPart } from 'ai';
import { z } from 'zod';
import { TasksService, Task } from '../../tasks/tasks.service';

// ---------------------------------------------------------------------------
// 1. Schemas: one per tool. Used twice — sent to the model, and to validate
//    the arguments the model writes back (model output = untrusted input).
// ---------------------------------------------------------------------------
const SCHEMAS = {
  get_current_date: z.object({}),
  search_tasks: z.object({
    query: z.string().nullable().describe('Keyword to match in the title. null = list all tasks.'),
    includeDone: z.boolean().describe('true to also return completed tasks'),
  }),
  create_task: z.object({
    title: z.string().min(1).describe('Short imperative title'),
    priority: z.enum(['low', 'medium', 'high']),
    dueDate: z.string().nullable().describe('YYYY-MM-DD. null if the user gave no date. Never invent one.'),
  }),
  complete_task: z.object({
    id: z.number().int().positive().describe('Task id, taken from a search_tasks result'),
  }),
};

export type ToolName = keyof typeof SCHEMAS;

// ---------------------------------------------------------------------------
// 2. Tool specs sent to the model on EVERY request (the model is stateless).
//    No `execute` → the SDK only reports the calls; we run them ourselves.
// ---------------------------------------------------------------------------
export const TOOL_SPECS = {
  get_current_date: tool({
    description: "Get today's date (YYYY-MM-DD). Call this before resolving relative dates like 'Friday'.",
    inputSchema: SCHEMAS.get_current_date,
  }),
  search_tasks: tool({
    description: "Find the user's tasks by keyword. Returns at most 10, each with its id.",
    inputSchema: SCHEMAS.search_tasks,
  }),
  create_task: tool({
    description: 'Create ONE new task. Only when the user clearly asks to add/create a task.',
    inputSchema: SCHEMAS.create_task,
  }),
  complete_task: tool({
    description: 'Mark ONE task as done by id. Only use an id returned by search_tasks; never guess ids.',
    inputSchema: SCHEMAS.complete_task,
  }),
};

/** Who is making the request. Comes from YOUR auth, never from the model. */
export interface ToolContext {
  userId: string;
}

export interface ToolCallInput {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export interface ToolRunTrace {
  id: string;
  name: string;
  input: unknown;
  ok: boolean;
  output?: unknown;
  error?: string;
  ms: number;
}

const isToolName = (name: string): name is ToolName => name in SCHEMAS;

// Send the model only what it needs; skip internal fields like userId.
const slim = (t: Task) => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate, done: t.done });

// ---------------------------------------------------------------------------
// 3. The executor: validate → run the real function → build the tool result.
// ---------------------------------------------------------------------------
@Injectable()
export class TaskToolRunner {
  private readonly logger = new Logger(TaskToolRunner.name);

  constructor(private readonly tasks: TasksService) {}

  async run(call: ToolCallInput, ctx: ToolContext): Promise<{ part: ToolResultPart; trace: ToolRunTrace }> {
    const started = Date.now();
    const done = (ok: boolean, payload: unknown) => {
      const trace: ToolRunTrace = {
        id: call.toolCallId,
        name: call.toolName,
        input: call.input,
        ok,
        ...(ok ? { output: payload } : { error: String(payload) }),
        ms: Date.now() - started,
      };
      this.logger.log(`  tool ${call.toolName} ${ok ? 'ok' : 'ERROR'} ${trace.ms}ms ${ok ? '' : trace.error}`);
      const part: ToolResultPart = {
        type: 'tool-result',
        toolCallId: call.toolCallId, // links this result to the model's call
        toolName: call.toolName,
        // Errors go BACK TO THE MODEL as a result, so it can recover.
        output: ok
          ? { type: 'json', value: JSON.parse(JSON.stringify(payload ?? null)) }
          : { type: 'error-text', value: String(payload) },
      };
      return { part, trace };
    };

    if (!isToolName(call.toolName)) return done(false, `Unknown tool: ${call.toolName}`);

    try {
      return done(true, await this.dispatch(call.toolName, call.input, ctx));
    } catch (err) {
      return done(false, (err as Error).message);
    }
  }

  private async dispatch(name: ToolName, rawInput: unknown, ctx: ToolContext): Promise<unknown> {
    // The SDK already validated against inputSchema before we get here; this is
    // defence in depth (the runner must stay safe if it is ever called directly).
    const parse = <S extends z.ZodTypeAny>(schema: S): z.infer<S> => {
      const r = schema.safeParse(rawInput);
      if (!r.success) throw new Error(`Invalid input: ${z.prettifyError(r.error)}`);
      return r.data;
    };

    switch (name) {
      case 'get_current_date':
        parse(SCHEMAS.get_current_date);
        return { today: new Date().toISOString().slice(0, 10) };

      case 'search_tasks': {
        const i = parse(SCHEMAS.search_tasks);
        return this.tasks.search(ctx.userId, i.query, i.includeDone).map(slim);
      }

      case 'create_task': {
        const i = parse(SCHEMAS.create_task);
        return slim(this.tasks.create(ctx.userId, i));
      }

      case 'complete_task': {
        const i = parse(SCHEMAS.complete_task);
        return slim(this.tasks.complete(ctx.userId, i.id)); // ctx.userId, never a model-written id
      }
    }
  }
}
