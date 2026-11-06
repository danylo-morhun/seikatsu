import { aishaTools } from "./aisha";
import { keizokuTools } from "./keizoku";
import { kurojiTools } from "./kuroji";
import { kyuuTools } from "./kyuu";
import { seiryuTools } from "./seiryu";
import { shellTools } from "./shell";
import { tsundokuTools } from "./tsundoku";
import type { ToolDef } from "./types";

/** Every tool seikatsu offers over MCP, shell first, then the apps in their usual order. */
export const ALL_TOOLS: ToolDef[] = [
	...shellTools,
	...kurojiTools,
	...seiryuTools,
	...tsundokuTools,
	...kyuuTools,
	...aishaTools,
	...keizokuTools,
];
