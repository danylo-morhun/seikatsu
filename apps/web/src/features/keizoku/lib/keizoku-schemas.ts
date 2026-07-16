import { z } from "zod";
import { FREQUENCY_TYPES } from "./constants";

const optionalText = z
	.string()
	.optional()
	.transform((v) => v?.trim() || undefined);

export const habitFormSchema = z
	.object({
		name: z.string().min(1, "Name required").max(100),
		emoji: z.string().min(1, "Emoji required").max(8),
		frequencyType: z.enum(FREQUENCY_TYPES),
		frequencyDays: z.array(z.number().int().min(0).max(6)).optional(),
		frequencyTarget: z.number().int().min(1).max(7).optional(),
		requiresPhoto: z.boolean().default(false),
	})
	.superRefine((v, ctx) => {
		if (v.frequencyType === "weekdays" && (!v.frequencyDays || v.frequencyDays.length === 0)) {
			ctx.addIssue({ code: "custom", path: ["frequencyDays"], message: "Select at least one day" });
		}
		if (v.frequencyType === "times_per_week" && !v.frequencyTarget) {
			ctx.addIssue({ code: "custom", path: ["frequencyTarget"], message: "Target required" });
		}
	});
export type HabitFormValues = z.infer<typeof habitFormSchema>;

export const logHabitSchema = z.object({
	habitId: z.string().uuid(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
	note: optionalText,
});
export type LogHabitValues = z.infer<typeof logHabitSchema>;
