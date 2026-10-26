import { ANSWER_KINDS, addDays, toStatus, waiting } from "@/features/kyuu/lib/stages";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendOnce } from "@/features/pwa/lib/push";
import { isTimeDue } from "@/features/pwa/lib/schedule";
import { and, db, eq, inArray, isNull, kyuuApplications, kyuuEvents } from "@seikatsu/db";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Morning digest: screenings/interviews today and tomorrow, follow-ups due, and sent ones that
 * went quiet long enough to close as ghosted — the same rules as the Now queue (lib/stages).
 */
export const notifyKyuu: Notifier = async ({ workspaceId, prefs, clock }) => {
	if (!prefs.kyuuEnabled || !isTimeDue(prefs.morningTime, clock)) return 0;
	const today = clock.day;
	const tomorrow = addDays(today, 1);

	const apps = await db
		.select({
			id: kyuuApplications.id,
			company: kyuuApplications.company,
			status: kyuuApplications.status,
			dateApplied: kyuuApplications.dateApplied,
		})
		.from(kyuuApplications)
		.where(and(eq(kyuuApplications.workspaceId, workspaceId), isNull(kyuuApplications.archivedAt)));
	if (apps.length === 0) return 0;

	const events = await db
		.select({
			applicationId: kyuuEvents.applicationId,
			kind: kyuuEvents.kind,
			date: kyuuEvents.date,
			time: kyuuEvents.time,
		})
		.from(kyuuEvents)
		.where(
			inArray(
				kyuuEvents.applicationId,
				apps.map((a) => a.id),
			),
		);

	const calls: { when: "today" | "tomorrow"; company: string; time: string | null }[] = [];
	let followUps = 0;
	let ghosts = 0;
	for (const app of apps) {
		const own = events.filter((e) => e.applicationId === app.id);
		for (const e of own) {
			if ((e.kind === "screening" || e.kind === "interview") && e.date) {
				if (e.date === today || e.date === tomorrow) {
					calls.push({
						when: e.date === today ? "today" : "tomorrow",
						company: app.company,
						time: e.time?.slice(0, 5) ?? null,
					});
				}
			}
		}
		const followedUpOn =
			own
				.filter((e) => e.kind === "follow_up" && e.date)
				.map((e) => e.date as string)
				.sort()
				.at(-1) ?? null;
		const due = waiting(
			{
				status: toStatus(app.status),
				dateApplied: app.dateApplied,
				followedUpOn,
				answered: own.some((e) => ANSWER_KINDS.includes(e.kind)),
			},
			today,
		)?.due;
		if (due === "follow_up") followUps++;
		if (due === "ghost") ghosts++;
	}

	const lines = [
		...calls
			// Today first ("today" > "tomorrow" backwards), then by time of day.
			.sort((a, b) => b.when.localeCompare(a.when) || (a.time ?? "").localeCompare(b.time ?? ""))
			.map((c) => `${c.company} ${c.when}${c.time ? ` at ${c.time}` : ""}`),
		followUps > 0 && `${plural(followUps, "follow-up", "follow-ups")} due`,
		ghosts > 0 && `${plural(ghosts, "application", "applications")} to close as ghosted`,
	].filter((l): l is string => !!l);
	if (lines.length === 0) return 0;

	const callsToday = calls.filter((c) => c.when === "today").length;
	const sent = await sendOnce(workspaceId, `kyuu:${today}`, {
		title: callsToday > 0 ? plural(callsToday, "call today", "calls today") : "Job search today",
		body: lines.join(" · "),
		url: "/kyuu",
		tag: "kyuu-morning",
	});
	return sent ? 1 : 0;
};
