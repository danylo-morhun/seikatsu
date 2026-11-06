import { shellTools } from "./shell";
import type { ToolDef } from "./types";

/** Every tool seikatsu offers over MCP, shell first, then the apps in their usual order. */
export const ALL_TOOLS: ToolDef[] = [...shellTools];
