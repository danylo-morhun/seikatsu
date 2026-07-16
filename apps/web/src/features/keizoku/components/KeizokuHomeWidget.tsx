import { getTodayProgress } from "@/features/keizoku/actions/stats";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";

export async function KeizokuHomeWidget({ userId }: { userId: string }) {
	const workspace = (await getWorkspace(userId)) ?? (await initializeWorkspace(userId));
	const today = new Date().toISOString().slice(0, 10);
	const progress = await getTodayProgress(workspace.id, today);

	if (progress.total === 0) return null;

	const pct = Math.round((progress.done / progress.total) * 100);

	return (
		<div className="relative mt-4 flex items-center gap-2">
			<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-400/15">
				<div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
			</div>
			<span className="shrink-0 text-xs font-medium text-emerald-400">
				{progress.done}/{progress.total} today
			</span>
		</div>
	);
}
