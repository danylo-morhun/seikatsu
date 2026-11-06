import type { ZodRawShape, z } from "zod";
import type { Workspace } from "@/lib/session";

export type ToolContext = {
	ws: Workspace;
	/** The user's calendar day, in their saved zone. */
	today: string;
};

/**
 * One MCP tool. `run` calls the app's own readers/actions (the session is the token's user,
 * see lib/actor.ts) and returns anything JSON-able; an `{ error }` result becomes a tool
 * error. `write` tools exist only for grants with the write scope, and their arguments
 * are kept in mcp_calls.
 */
export type ToolDef<S extends ZodRawShape = ZodRawShape> = {
	name: string;
	title: string;
	description: string;
	input: S;
	write?: boolean;
	/** Same call twice = same result (a tick, a status). */
	idempotent?: boolean;
	run: (args: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
};

export const tool = <S extends ZodRawShape>(def: ToolDef<S>) => def as unknown as ToolDef;
