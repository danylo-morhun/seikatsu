// The week plan's inputs, shared by the actions and the offline replay (pwa/lib/registry).

import { z } from "zod";
import { daySchema, pickSchema } from "@/features/day/lib/schemas";
import { MAX_FOCUS } from "@/features/week/lib/rhythm";

export const weekSaveSchema = z.object({
	weekStart: daySchema,
	focus: z.array(pickSchema).max(MAX_FOCUS),
});
export const weekTickSchema = z.object({
	weekStart: daySchema,
	key: pickSchema.shape.key,
	done: z.boolean(),
});
