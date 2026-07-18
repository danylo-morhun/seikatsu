"use server";

import { auth } from "@/auth";

export interface ExtractedApplication {
	company: string;
	role: string;
	jobUrl: string | null;
	source: string | null;
	notes: string | null;
}

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const RESPONSE_SCHEMA = {
	type: "OBJECT",
	properties: {
		company: { type: "STRING", description: "Hiring company name" },
		role: { type: "STRING", description: "Job title / role" },
		jobUrl: {
			type: "STRING",
			nullable: true,
			description: "URL of the job posting if one appears in the text, else null",
		},
		source: {
			type: "STRING",
			nullable: true,
			description:
				"Job board or platform the posting is from (e.g. LinkedIn, Djinni, hh.ru), else null",
		},
		notes: {
			type: "STRING",
			nullable: true,
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
	if (!process.env.GEMINI_API_KEY) return { error: "AI extraction is not configured" };

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 20_000);

	try {
		const res = await fetch(GEMINI_URL, {
			method: "POST",
			signal: controller.signal,
			headers: {
				"Content-Type": "application/json",
				"X-goog-api-key": process.env.GEMINI_API_KEY,
			},
			body: JSON.stringify({
				contents: [
					{
						parts: [
							{
								text: `Extract job application fields from this job posting.\n\n${text.slice(0, 12_000)}`,
							},
						],
					},
				],
				generationConfig: {
					responseMimeType: "application/json",
					responseSchema: RESPONSE_SCHEMA,
				},
			}),
		});

		if (!res.ok) return { error: "Extraction failed, try again" };

		const json = await res.json();
		const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
		if (typeof raw !== "string")
			return { error: "Could not extract application details from that text" };

		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const company = typeof parsed.company === "string" ? parsed.company.trim() : "";
		const role = typeof parsed.role === "string" ? parsed.role.trim() : "";
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
	} catch (err) {
		if (err instanceof Error && err.name === "AbortError") {
			return { error: "Extraction timed out, try again" };
		}
		return { error: "Extraction failed, try again" };
	} finally {
		clearTimeout(timeout);
	}
}
