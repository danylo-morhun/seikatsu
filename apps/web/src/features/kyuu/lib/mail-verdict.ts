// What Gemini says about one mail, and what Kyuu does with it. Pure.

import type { MailCandidate } from "./mail-match";

/** The answers a mail can carry; anything else isn't news. */
export const MAIL_KINDS = ["rejected", "screening", "interview", "offer"] as const;
export type MailKind = (typeof MAIL_KINDS)[number];

export function isMailKind(value: unknown): value is MailKind {
	return (MAIL_KINDS as readonly unknown[]).includes(value);
}

export function verdictSchema(candidates: number) {
	return {
		type: "object",
		properties: {
			match: {
				type: "string",
				enum: ["none", ...Array.from({ length: candidates }, (_, i) => String(i))],
				description: "Which application the mail is about, by its number, or none",
			},
			kind: { type: "string", enum: ["none", ...MAIL_KINDS] },
			confident: {
				type: "boolean",
				description: "True only when both the application and the kind are clear",
			},
			date: {
				type: ["string", "null"],
				description: "YYYY-MM-DD of a booked screening or interview, if the mail gives one",
			},
			time: { type: ["string", "null"], description: "HH:MM of that booking, 24h" },
			summary: { type: "string", description: "One short line: who wrote and what they want" },
		},
		required: ["match", "kind", "confident", "date", "time", "summary"],
	};
}

export function verdictPrompt(
	mail: { from: string; subject: string; day: string; body: string },
	candidates: (MailCandidate & { dateApplied: string })[],
): string {
	const list = candidates
		.map((c, i) => `#${i} ${c.company} — ${c.role} (sent ${c.dateApplied})`)
		.join("\n");
	return `You sort a job seeker's mail. Decide whether this mail is a company's answer to one of
their applications, and what kind:
- rejected: they won't go ahead.
- screening: a recruiter or HR wants an intro call, asks for availability, or books a screen.
- interview: a technical / hiring-manager interview, a test task, or a later round.
- offer: a job offer.
- none: anything else — "we received your application", job alerts and digests, newsletters,
  marketing, a recruiter pitching a job that isn't on the list, or mail the user sent.
Only match an application from the list. Set confident=false when the company or the role is
ambiguous (two listed roles at one company, a different company) or the kind is unclear.
The mail arrived on ${mail.day}; resolve "tomorrow", "Thursday" etc. from that day.

Applications:
${list || "(none)"}

From: ${mail.from}
Subject: ${mail.subject}

${mail.body.slice(0, 4_000)}`;
}

export interface Verdict {
	applicationId: string | null;
	kind: MailKind | null;
	confident: boolean;
	date: string | null;
	time: string | null;
	summary: string | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Gemini's answer, checked: unknown numbers, kinds and malformed days become nothing. */
export function readVerdict(raw: unknown, candidates: { id: string }[]): Verdict {
	const v = (raw ?? {}) as Record<string, unknown>;
	const index = typeof v.match === "string" && /^\d+$/.test(v.match) ? Number(v.match) : -1;
	const kind = isMailKind(v.kind) ? v.kind : null;
	const date = typeof v.date === "string" && DAY.test(v.date) ? v.date : null;
	return {
		applicationId: candidates[index]?.id ?? null,
		kind,
		confident: v.confident === true,
		date,
		time: date && typeof v.time === "string" && TIME.test(v.time) ? v.time : null,
		summary: typeof v.summary === "string" ? v.summary.trim().slice(0, 300) || null : null,
	};
}

/** Applied on its own, waiting for review, or not news at all. */
export function stateOf(v: Verdict): "applied" | "review" | "skipped" {
	if (!v.kind) return "skipped";
	return v.applicationId && v.confident ? "applied" : "review";
}
