"use server";

import { auth } from "@/auth";
import { GeminiError, askGemini, geminiConfigured } from "../lib/gemini";

export interface ExtractedApplication {
	company: string;
	role: string;
	jobUrl: string | null;
	source: string | null;
	notes: string | null;
}

const RESPONSE_SCHEMA = {
	type: "object",
	properties: {
		company: { type: "string", description: "Hiring company name" },
		role: { type: "string", description: "Job title / role" },
		jobUrl: {
			type: ["string", "null"],
			description: "URL of the job posting if one appears in the text, else null",
		},
		source: {
			type: ["string", "null"],
			description:
				"Job board or platform the posting is from (e.g. LinkedIn, Djinni, hh.ru), else null",
		},
		notes: {
			type: ["string", "null"],
			description:
				"Short (1-3 sentence) summary of seniority, tech stack, salary/comp, or other notable details, else null",
		},
	},
	required: ["company", "role", "jobUrl", "source", "notes"],
};

export async function extractApplicationFromText(
	text: string,
): Promise<{ error: string } | { success: true; data: ExtractedApplication }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	if (!text.trim()) return { error: "Paste a job posting first" };
	if (!geminiConfigured()) return { error: "AI extraction is not configured" };

	let parsed: Record<string, unknown>;
	try {
		parsed = (await askGemini(
			`Extract job application fields from this job posting.\n\n${text.slice(0, 12_000)}`,
			RESPONSE_SCHEMA,
		)) as Record<string, unknown>;
	} catch (err) {
		if (err instanceof GeminiError && err.message.includes("timed out"))
			return { error: "Extraction timed out, try again" };
		return { error: "Extraction failed, try again" };
	}

	const company = typeof parsed?.company === "string" ? parsed.company.trim() : "";
	const role = typeof parsed?.role === "string" ? parsed.role.trim() : "";
	if (!company || !role) {
		return { error: "Couldn't find a company and role in that text" };
	}

	return {
		success: true,
		data: {
			company,
			role,
			jobUrl: typeof parsed.jobUrl === "string" ? parsed.jobUrl : null,
			source: typeof parsed.source === "string" ? parsed.source : null,
			notes: typeof parsed.notes === "string" ? parsed.notes : null,
		},
	};
}
