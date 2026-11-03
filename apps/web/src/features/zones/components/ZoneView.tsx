import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle } from "@/components/PageTitle";
import { ZoneTiles } from "@/features/home/components/AppTiles";
import { StartHere } from "@/features/home/components/StartHere";
import type { AppHref } from "@/features/home/components/Tile";
import {
	loadCaptures,
	loadCar,
	loadCards,
	loadHabits,
	loadJobs,
	loadReading,
	loadWants,
	type Started,
} from "@/features/home/lib/today";
import { ZoneKeys } from "@/features/zones/components/ZoneKeys";
import { buildQueue, type QueueItem, type ZoneData } from "@/features/zones/lib/queue";
import { APPS_CONFIG } from "@/lib/app-themes";
import type { Workspace } from "@/lib/session";
import type { Zone } from "@/lib/zones";

interface Props {
	zone: Zone;
	ws: Workspace;
	today: string;
	started: Started;
}

/** A life area on one page: everything its apps wait on, most urgent first, then their tiles. */
export function ZoneView({ zone, ws, today, started }: Props) {
	const apps = zone.apps as readonly AppHref[];
	const listed = apps.filter((href) => !ws.hiddenApps.includes(href));
	const hidden = apps.filter((href) => ws.hiddenApps.includes(href));
	const fresh = listed.filter((href) => started[href] === false);
	const shown = listed.filter((href) => !fresh.includes(href));

	return (
		<div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-16 sm:px-8 md:py-8">
			<ZoneKeys apps={listed} />
			<PageTitle
				title={
					<span className="inline-flex items-center gap-2">
						<span aria-hidden className="text-muted-foreground">
							{zone.kanji}
						</span>
						{zone.name}
					</span>
				}
				subtitle={zone.pitch}
			/>

			{shown.length > 0 && (
				<section aria-labelledby="zone-waiting" className="mb-8">
					<h2
						id="zone-waiting"
						className="border-b border-(--head-rule) px-(--head-inset) pb-2 text-sm font-medium text-muted-foreground"
					>
						Waiting on you
					</h2>
					<Suspense fallback={<QueueSkeleton />}>
						<Queue zone={zone} ws={ws} today={today} apps={shown} />
					</Suspense>
				</section>
			)}

			{shown.length > 0 && (
				<section aria-labelledby="zone-apps" className="space-y-2">
					<h2 id="zone-apps" className="px-1 text-xs font-medium text-muted-foreground">
						Apps
					</h2>
					<ZoneTiles apps={shown} ws={ws} today={today} start={1} />
				</section>
			)}

			{(fresh.length > 0 || hidden.length > 0) && (
				<div className="mt-8">
					<StartHere
						apps={fresh}
						hidden={hidden}
						all={shown.length === 0}
						offset={shown.length + 1}
					/>
				</div>
			)}
		</div>
	);
}

async function Queue({
	zone,
	ws,
	today,
	apps,
}: {
	zone: Zone;
	ws: Workspace;
	today: string;
	apps: readonly AppHref[];
}) {
	const has = (href: AppHref) => apps.includes(href);
	// Only the summaries this zone shows; the rest of the day isn't read.
	const [captures, wants, cards, habits, jobs, car, reading] = await Promise.all([
		has("/kuroji") ? loadCaptures(ws) : null,
		has("/hoshii") ? loadWants(ws, today) : null,
		has("/seiryu") ? loadCards(ws, today) : null,
		has("/keizoku") ? loadHabits() : null,
		has("/kyuu") ? loadJobs() : null,
		has("/aisha") ? loadCar(today) : null,
		has("/tsundoku") ? loadReading() : null,
	]);
	const data: ZoneData = { captures, wants, cards, habits, jobs, car, reading };
	const items = buildQueue(zone.id, data, today);

	if (items.length === 0)
		return <p className="px-(--head-inset) py-6 text-sm text-muted-foreground">Nothing waiting.</p>;

	return (
		<ol className="inset-group mt-2">
			{items.map((item, i) => (
				<QueueRow key={item.key} item={item} index={i} />
			))}
		</ol>
	);
}

function QueueRow({ item, index }: { item: QueueItem; index: number }) {
	const app = APPS_CONFIG[item.app];
	return (
		<li className="animate-rise" style={{ "--i": index } as React.CSSProperties}>
			<Link
				href={item.href}
				prefetch
				className="-mx-(--group-px) flex min-h-12 items-center gap-3 rounded-field px-(--group-px) py-2.5 transition-colors duration-150 hover:bg-surface-2/60"
			>
				<span
					aria-hidden
					className={cn(
						app.theme,
						"flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[13px] font-semibold text-primary",
					)}
				>
					{app.kanji}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-medium">{item.title}</span>
					<span
						className={cn(
							"block truncate text-xs",
							item.tone === "overdue" ? "text-negative" : "text-muted-foreground",
						)}
					>
						{item.note}
					</span>
				</span>
				<span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">{app.name}</span>
			</Link>
		</li>
	);
}

function QueueSkeleton() {
	return (
		<div className="inset-group mt-2" aria-hidden>
			{[0, 1, 2].map((i) => (
				<div key={i} className="flex min-h-12 items-center gap-3 py-2.5">
					<span className="size-7 shrink-0 rounded-md bg-muted/40" />
					<span className="h-3 w-40 rounded bg-muted/40" />
				</div>
			))}
		</div>
	);
}
