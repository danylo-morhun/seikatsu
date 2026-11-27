// An event's input, shared by the actions, the dialog and the offline replay (pwa/lib/registry).

import { z } from "zod";
import { REPEATS } from "@/features/calendar/lib/events";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const eventSchema = z
	.object({
		/** Made on the device: saving it again updates the same event. */
		id: z.uuid(),
		title: z.string().trim().min(1, "Name the event").max(200),
		date: day,
		endDate: day.nullable(),
		startTime: time.nullable(),
		endTime: time.nullable(),
		repeat: z.enum(REPEATS).nullable(),
		repeatEvery: z.int().min(1).max(99),
		repeatUntil: day.nullable(),
		// Defaults: an older outbox entry (saved before these existed) replays as before.
		repeatCount: z.int().min(1).max(999).nullable().default(null),
		repeatDays: z.array(z.int().min(1).max(7)).max(7).nullable().default(null),
		repeatByWeekday: z.boolean().default(false),
		skip: z.array(day).max(1000).default([]),
		note: z.string().trim().max(2000).nullable(),
	})
	.refine((e) => !e.endDate || e.endDate >= e.date, {
		message: "It ends before it starts",
		path: ["endDate"],
	})
	.refine((e) => !e.endTime || (e.startTime != null && e.endTime > e.startTime), {
		message: "It ends before it starts",
		path: ["endTime"],
	})
	.refine((e) => !(e.repeatUntil && e.repeatCount), {
		message: "Ends on a day or after a count, not both",
		path: ["repeatCount"],
	})
	.refine((e) => !e.repeatUntil || e.repeatUntil >= e.date, {
		message: "It stops repeating before it starts",
		path: ["repeatUntil"],
	});

export type CalendarEventInput = z.input<typeof eventSchema>;

export const deleteEventSchema = z.object({ id: z.uuid() });

/** A change to part of a repeating event: the rows it saves and the ones it deletes, at once. */
export const eventSetSchema = z.object({
	save: z.array(eventSchema).max(2),
	remove: z.array(z.uuid()).max(1),
});

export type EventSetInput = z.input<typeof eventSetSchema>;
