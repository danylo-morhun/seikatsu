// Fills in where jobs are, from the posting text. Not a "use server" module: called from
// the Settings action and the mail sync, both of which own the workspace check.

import { and, db, desc, eq, gte, isNull, kyuuApplications } from "@seikatsu/db";
import { toCountryCode } from "../lib/country";
import { askGemini } from "../lib/gemini";

const BATCH = 15;
const POSTING_CHARS = 1_500;

const SCHEMA = {
	type: "ARRAY",
	items: {
		type: "OBJECT",
		properties: {
			i: { type: "INTEGER" },
			country: {
				type: "STRING",
				nullable: true,
				description: "ISO 3166-1 alpha-2 code, or null when unclear",
			},
		},
		required: ["i", "country"],
	},
};

const PROMPT = `For each job application below, give the country the job is in as an ISO 3166-1
alpha-2 code. On-site or hybrid: the office's country. Remote: the country the role is hired
in or limited to; if it's open anywhere, the hiring company's home country. Use null when the
text doesn't make it reasonably clear — never guess from the job board alone.`;

type Candidate = {
	id: string;
	company: string;
	role: string;
	jobUrl: string | null;
	location: string | null;
	remote: boolean | null;
	jobDescription: string | null;
};

/** Writes a country to rows that have none, newest first. Throws GeminiError. */
export async function fillCountries(
	workspaceId: string,
	opts: { since?: Date; limit: number },
): Promise<{ checked: number; filled: number }> {
	const rows: Candidate[] = await db
		.select({
			id: kyuuApplications.id,
			company: kyuuApplications.company,
			role: kyuuApplications.role,
			jobUrl: kyuuApplications.jobUrl,
			location: kyuuApplications.location,
			remote: kyuuApplications.remote,
			jobDescription: kyuuApplications.jobDescription,
		})
		.from(kyuuApplications)
		.where(
			and(
				eq(kyuuApplications.workspaceId, workspaceId),
				isNull(kyuuApplications.country),
				opts.since ? gte(kyuuApplications.createdAt, opts.since) : undefined,
			),
		)
		.orderBy(desc(kyuuApplications.dateApplied), desc(kyuuApplications.createdAt))
		.limit(opts.limit);

	let filled = 0;
	for (let start = 0; start < rows.length; start += BATCH) {
		const batch = rows.slice(start, start + BATCH);
		const listed = batch
			.map((r, i) =>
				[
					`#${i}`,
					`Company: ${r.company}`,
					`Role: ${r.role}`,
					r.jobUrl && `Link: ${r.jobUrl}`,
					r.location && `Location: ${r.location}`,
					r.remote != null && `Remote: ${r.remote ? "yes" : "no"}`,
					r.jobDescription && `Posting: ${r.jobDescription.slice(0, POSTING_CHARS)}`,
				]
					.filter(Boolean)
					.join("\n"),
			)
			.join("\n\n");
		const answer = await askGemini(`${PROMPT}\n\n${listed}`, SCHEMA, 40_000);
		const found = new Map<string, string>();
		for (const item of Array.isArray(answer) ? answer : []) {
			const row = batch[(item as { i?: unknown }).i as number];
			const code = toCountryCode((item as { country?: unknown }).country);
			if (row && code) found.set(row.id, code);
		}
		if (found.size === 0) continue;
		await db.transaction(async (tx) => {
			for (const [id, country] of found)
				await tx.update(kyuuApplications).set({ country }).where(eq(kyuuApplications.id, id));
		});
		filled += found.size;
	}
	return { checked: rows.length, filled };
}
