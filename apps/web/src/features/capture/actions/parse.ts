"use server";

import { z } from "zod";
import { getCaptureContext } from "@/features/capture/lib/context";
import {
	buildPrompt,
	type CaptureContext,
	type PlannedAction,
	RESPONSE_SCHEMA,
	toPlan,
} from "@/features/capture/lib/plan";
import { askGemini, GeminiError, geminiConfigured, QUICK } from "@/lib/gemini";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

export type CapturePlan = {
	workspaceId: string;
	/** The user's day, so the dialog can say "today". */
	today: string;
	actions: PlannedAction[];
	/** What the line asked for that can't be done, and why. */
	skipped: string[];
	/** What the dialog's pickers offer when an action still needs a wallet, category or project. */
	options: Pick<CaptureContext, "wallets" | "expenseCategories" | "incomeCategories" | "projects">;
};

/** The free tier's light model takes 15-20 s for a line; past this, give up. */
const READ_MS = 40_000;

const textSchema = z.string().trim().min(1, "Type what happened").max(500, "Keep it to one line");

/** Reads the line and returns what it would do. Writes nothing: the dialog saves each action
 * through its app's own action once the user confirms. */
export async function parseCapture(
	text: string,
): Promise<{ error: string } | { success: true; data: CapturePlan }> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	const parsed = textSchema.safeParse(text);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	if (!geminiConfigured()) return { error: "Capture isn't set up (no GEMINI_API_KEY)" };

	const ctx = await getCaptureContext(ws, await getUserToday());
	let answer: unknown;
	try {
		answer = await askGemini(buildPrompt(parsed.data, ctx), RESPONSE_SCHEMA, READ_MS, QUICK);
	} catch (err) {
		console.error("[capture] read failed", err);
		if (err instanceof GeminiError && err.limited)
			return { error: "Out of AI requests for now. Try again later." };
		return { error: "Couldn't read that. Try again." };
	}

	const { wallets, expenseCategories, incomeCategories, projects } = ctx;
	return {
		success: true,
		data: {
			workspaceId: ws.id,
			today: ctx.today,
			...toPlan(answer, ctx),
			options: { wallets, expenseCategories, incomeCategories, projects },
		},
	};
}
