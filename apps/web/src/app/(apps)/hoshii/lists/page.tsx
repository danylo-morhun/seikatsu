import { getChromeData, getHoshii, live } from "@/features/hoshii/actions/data";
import { ListsView } from "@/features/hoshii/components/ListsView";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";

const ORDER = { decide: 0, plan: 1, cooling: 2, bought: 3, released: 4 } as const;

export default async function HoshiiListsPage({
	searchParams,
}: {
	searchParams: Promise<{ list?: string; past?: string }>;
}) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const [params, today] = await Promise.all([searchParams, getUserToday()]);
	const [data, chrome] = await Promise.all([
		getHoshii(workspace, today),
		getChromeData(workspace, today),
	]);

	const listId = data.lists.some((l) => l.id === params.list) ? (params.list ?? null) : null;
	const past = params.past === "1";
	const ranks = Object.fromEntries(data.queue.plan.map((p, i) => [p.item.id, i + 1]));
	const stage = (i: (typeof data.items)[number]) =>
		i.state === "cooling" ? (i.coolUntil <= today ? "decide" : "cooling") : i.state;
	// Decide first, then the Plan in its order, cooling soonest-first, then the past, newest first.
	const key = (i: (typeof data.items)[number]) => {
		const s = stage(i);
		if (s === "plan") return String(ranks[i.id] ?? 0).padStart(4, "0");
		if (s === "bought" || s === "released")
			return (i.boughtOn ?? i.releasedOn ?? "").replace(/\d/g, (d) => String(9 - Number(d)));
		return i.coolUntil;
	};
	const shown = data.items
		.filter((i) => (past || live(i)) && (listId == null || i.listId === listId))
		.sort((a, b) => ORDER[stage(a)] - ORDER[stage(b)] || key(a).localeCompare(key(b)));

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<ListsView
				items={data.items}
				shown={shown}
				lists={data.lists}
				listId={listId}
				past={past}
				ranks={ranks}
				chrome={chrome}
				today={today}
			/>
		</div>
	);
}
