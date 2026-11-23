import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFrame } from "@/components/AppFrame";
import { EveningFlow, type LeftRow } from "@/features/day/components/EveningFlow";
import { EveningLog } from "@/features/day/components/EveningLog";
import { loadDay, readCardsOn } from "@/features/day/lib/data";
import { loadAgenda } from "@/features/home/lib/agenda";
import { loadHabits } from "@/features/home/lib/today";
import { formatMoney } from "@/features/hoshii/lib/format";
import { addDays } from "@/features/seiryu/lib/filters";
import { getCurrentWorkspace, requireModule } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

const asMoney = (amount: number, currency: string) => formatMoney(amount, currency, true);

export default async function EveningPage() {
	await requireModule("/day");
	const session = await auth();
	if (!session) redirect("/");
	const [workspace, today] = await Promise.all([getCurrentWorkspace(), getUserToday()]);
	if (!workspace) redirect("/");
	const tomorrow = addDays(today, 1);
	const [day, agenda, habits, cardsTomorrow] = await Promise.all([
		loadDay(workspace, today, asMoney),
		loadAgenda(workspace, today),
		loadHabits(),
		readCardsOn(workspace.id, tomorrow).catch(() => []),
	]);

	// What's left: the day's picks not done, then cards due by today that weren't picked.
	const picked = new Set(day.picks.map((p) => p.key));
	const left: LeftRow[] = [
		...day.picks
			.filter((p) => !p.done)
			.map((p) => ({
				key: p.key,
				title: p.title,
				note: p.live?.note ?? "My day",
				app: p.app,
				cardId: p.card?.id ?? p.live?.cardId ?? null,
				picked: true,
			})),
		...day.queue
			.filter((q) => q.cardId && q.tone !== "info" && !picked.has(q.key))
			.map((q) => ({
				key: q.key,
				title: q.title,
				note: q.note,
				app: q.app,
				cardId: q.cardId ?? null,
				picked: false,
			})),
	];

	const habitList = habits?.habits ?? [];
	const tomorrowRows = [
		...(agenda.jobs?.calls ?? [])
			.filter((c) => c.date === tomorrow)
			.map((c) => ({
				key: `call:${c.id}`,
				time: c.time,
				title: `${c.kind === "interview" ? "Interview" : "Screening"} · ${c.company}`,
			})),
		...cardsTomorrow.map((c) => ({
			key: `card:${c.id}`,
			time: c.dueTime?.slice(0, 5) ?? null,
			title: c.title,
		})),
	].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));

	return (
		<AppFrame>
			<EveningFlow
				today={today}
				closed={Boolean(day.plan?.closedAt)}
				planned={
					day.plan?.plannedAt
						? { done: day.picks.filter((p) => p.done).length, of: day.picks.length }
						: null
				}
				habits={{ done: habitList.filter((h) => h.done).length, of: habitList.length }}
				payments={agenda.money?.captures ?? 0}
				left={left}
				tomorrow={tomorrowRows}
				log={<EveningLog today={today} payments={agenda.money?.captures ?? 0} />}
			/>
		</AppFrame>
	);
}
