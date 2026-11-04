import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { Suspense } from "react";
import type { AppHref } from "@/features/home/components/Line";
import { StartHere } from "@/features/home/components/StartHere";
import { Figure, FigureText } from "@/features/home/components/TodayView";
import { loadAgenda } from "@/features/home/lib/agenda";
import { buildQueue } from "@/features/home/lib/queue";
import type { Started } from "@/features/home/lib/today";
import { APPS_CONFIG } from "@/lib/app-themes";
import type { Workspace } from "@/lib/session";

const APP_HREFS = Object.keys(APPS_CONFIG) as AppHref[];

/**
 * Every app, one tile each: its seal, one figure and what waits in it. The shell's way into the
 * apps (the sidebar lists only Today, Week, Goals and Apps); 1–7 open them in this order.
 */
export function AppsView({
	ws,
	today,
	started,
}: {
	ws: Workspace;
	today: string;
	started: Started;
}) {
	const listed = APP_HREFS.filter((href) => !ws.hiddenApps.includes(href));
	const hidden = APP_HREFS.filter((href) => ws.hiddenApps.includes(href));
	const fresh = listed.filter((href) => started[href] === false);
	const live = listed.filter((href) => !fresh.includes(href));

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-5 pb-28 sm:px-8 md:space-y-8 md:py-8">
			<header className="animate-rise">
				<h1 className="text-xl font-semibold tracking-tight md:text-3xl">Apps</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Each one in full: its history, its settings, everything Today only points to.
				</p>
			</header>
			<ul className="grid animate-rise grid-cols-2 gap-2 [--i:1] sm:grid-cols-3 lg:grid-cols-4 lg:gap-3">
				{live.map((href, i) => (
					<AppTile key={href} href={href} index={i + 1}>
						<Suspense fallback={<FigureText value={null} label={APPS_CONFIG[href].label} />}>
							<Figure href={href} ws={ws} today={today} />
						</Suspense>
						<Suspense fallback={<span className="h-4" />}>
							<Waiting href={href} ws={ws} today={today} />
						</Suspense>
					</AppTile>
				))}
			</ul>
			{(fresh.length > 0 || hidden.length > 0) && (
				<StartHere apps={fresh} hidden={hidden} all={false} offset={2} />
			)}
		</div>
	);
}

function AppTile({
	href,
	index,
	children,
}: {
	href: AppHref;
	index: number;
	children: React.ReactNode;
}) {
	const app = APPS_CONFIG[href];
	return (
		<li className={cn(app.theme, "min-w-0")}>
			<Link
				href={href}
				prefetch
				aria-keyshortcuts={index <= 7 ? String(index) : undefined}
				className="flex h-full flex-col gap-1 rounded-group bg-surface px-3.5 py-3 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span className="flex items-baseline gap-2">
					<span aria-hidden className="text-[15px] font-semibold text-primary">
						{app.kanji}
					</span>
					<span className="truncate text-sm font-medium">{app.name}</span>
				</span>
				{children}
			</Link>
		</li>
	);
}

/** "3 waiting": that app's rows on Today's list. */
async function Waiting({ href, ws, today }: { href: AppHref; ws: Workspace; today: string }) {
	const items = buildQueue(await loadAgenda(ws, today), today).filter((i) => i.app === href);
	if (items.length === 0) return null;
	const late = items.some((i) => i.tone === "overdue");
	return (
		<span className={cn("text-[11px]", late ? "text-negative" : "text-muted-foreground")}>
			{items.length} waiting{late ? ", late" : ""}
		</span>
	);
}
