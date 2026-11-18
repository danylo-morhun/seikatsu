// The day's inputs, shared by the actions and the offline replay (pwa/lib/registry).

import { z } from "zod";
import { MAX_PICKS } from "@/features/day/lib/day";

export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A queue key: `app:…`, short. */
const key = z
	.string()
	.min(3)
	.max(200)
	.regex(/^[a-z]+:[^\s]+$/);

/** Only links inside seikatsu: "/kuroji?…", never "//host" or "https:". */
const href = z
	.string()
	.max(500)
	.regex(/^\/(?!\/)/);

export const pickSchema = z.object({
	key,
	title: z.string().trim().min(1).max(200),
	href,
	app: z
		.string()
		.max(40)
		.regex(/^\/[a-z]*$/),
});

export const snoozeSchema = z.object({ key, until: daySchema });
export const unsnoozeSchema = z.object({ key });
export const planSchema = z.object({ day: daySchema, picks: z.array(pickSchema).max(MAX_PICKS) });
export const tickSchema = z.object({ day: daySchema, key, done: z.boolean() });
export const dropSchema = z.object({ day: daySchema, key });
export const closeSchema = z.object({ day: daySchema });
