import { getCar } from "@/features/aisha/actions/data";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendNew } from "@/features/pwa/lib/push";
import { isTimeDue } from "@/features/pwa/lib/schedule";
import { aishaVehicles, db, eq } from "@seikatsu/db";

/** Days-left marks a document is announced at; each mark once per expiry date. */
const DOCUMENT_MARKS = [30, 7, 1, 0] as const;

function documentMark(daysLeft: number): number | null {
	return [...DOCUMENT_MARKS].reverse().find((m) => daysLeft <= m) ?? null;
}

function inDays(days: number): string {
	if (days < 0) return `expired ${-days}d ago`;
	if (days === 0) return "expires today";
	if (days === 1) return "expires tomorrow";
	return `expires in ${days} days`;
}

/**
 * Morning check: maintenance turning "soon" or "overdue", and documents reaching 30/7/1/0 days
 * left. Each step is told once (the log key carries it), so a quiet morning sends nothing.
 */
export const notifyAisha: Notifier = async ({ workspaceId, prefs, clock }) => {
	if (!prefs.aishaEnabled || !isTimeDue(prefs.morningTime, clock)) return 0;

	const vehicles = await db
		.select()
		.from(aishaVehicles)
		.where(eq(aishaVehicles.workspaceId, workspaceId));
	const entries: { key: string; line: string; overdue: boolean }[] = [];
	for (const vehicle of vehicles) {
		const { items, documents } = await getCar(vehicle, clock.day);
		const car = vehicles.length > 1 ? `${vehicle.make}: ` : "";
		for (const item of items) {
			const { status, dueKm, dueDate } = item.due;
			if (status !== "soon" && status !== "overdue") continue;
			entries.push({
				// Re-announced only when it's done and comes due again (new due km/date).
				key: `aisha:item:${item.id}:${status}:${dueKm ?? ""}:${dueDate ?? ""}`,
				line: `${car}${item.name} ${status === "overdue" ? "overdue" : "due soon"}`,
				overdue: status === "overdue",
			});
		}
		for (const doc of documents) {
			const mark = documentMark(doc.daysLeft);
			if (mark === null) continue;
			entries.push({
				key: `aisha:doc:${doc.id}:${doc.expiresOn}:${mark}`,
				line: `${car}${doc.name} ${inDays(doc.daysLeft)}`,
				overdue: doc.daysLeft <= 0,
			});
		}
	}

	const sent = await sendNew(workspaceId, entries, (fresh) => ({
		title: fresh.some((e) => e.overdue) ? "Car: needs attention" : "Car: coming up",
		body: fresh.map((e) => e.line).join(" · "),
		url: "/aisha",
		tag: "aisha",
	}));
	return sent ? 1 : 0;
};
