import { z } from "zod";
import { FREQUENCY_TYPES, TIME_OF_DAY_VALUES } from "./constants";

const habitFields = z.object({
	name: z.string().trim().min(1, "Name the habit").max(100, "Keep the name under 100 characters"),
	emoji: z.string().trim().min(1, "Pick an icon").max(16),
	frequencyType: z.enum(FREQUENCY_TYPES),
	frequencyDays: z.array(z.number().int().min(0).max(6)).max(7).nullable().optional(),
	frequencyTarget: z.number().int().min(1).max(7).nullable().optional(),
	timeOfDay: z.enum(TIME_OF_DAY_VALUES),
});

function checkSchedule(v: z.infer<typeof habitFields>, ctx: z.RefinementCtx) {
	if (v.frequencyType === "weekdays" && !v.frequencyDays?.length) {
		ctx.addIssue({ code: "custom", path: ["frequencyDays"], message: "Pick at least one day" });
	}
	if (v.frequencyType === "times_per_week" && !v.frequencyTarget) {
		ctx.addIssue({ code: "custom", path: ["frequencyTarget"], message: "How many times a week?" });
	}
}

export const habitFormSchema = habitFields.superRefine(checkSchedule);
export type HabitFormValues = z.input<typeof habitFormSchema>;

/** An edit sends only what changed; the merged habit is checked again in full. */
export const habitPatchSchema = habitFields.partial();
export type HabitPatch = z.input<typeof habitPatchSchema>;

export const dayNoteSchema = z.object({
	habitId: z.string().uuid(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
	note: z
		.string()
		.max(2000, "Keep the note under 2000 characters")
		.transform((v) => v.trim() || null),
	removePhoto: z.boolean(),
});
