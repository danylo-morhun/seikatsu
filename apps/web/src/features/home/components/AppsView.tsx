import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { Suspense } from "react";
import type { AppHref } from "@/features/home/components/Line";
import { StartHere } from "@/features/home/components/StartHere";
import { HomeKeys } from "@/features/home/components/TodayIslands";
import { figureOf } from "@/features/home/components/TodayView";
import { loadAgenda } from "@/features/home/lib/agenda";
import { spanOf } from "@/features/home/lib/apps-grid";
import { buildQueue } from "@/features/home/lib/queue";
import type { Started } from "@/features/home/lib/today";
import { APPS_CONFIG } from "@/lib/app-themes";
import type { Workspace } from "@/lib/session";

const APP_HREFS = Object.keys(APPS_CONFIG) as AppHref[];

/**
 * Every app as a lacquer box: its figure first, its kanji as a watermark, and the most pressing
 * thing waiting in it. The shell's way into the apps (the sidebar lists only Today, Week, Goals
 * and Apps); 1–7 open them in this order.
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
			<HomeKeys listed={live} />
			<header className="animate-rise">
				<h1 className="text-xl font-semibold tracking-tight md:text-3xl">Apps</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Where each thing lives in full. Press 1–7 to open.
				</p>
			</header>
			{live.length > 0 && (
				<ul className="grid animate-rise grid-cols-2 gap-2.5 [--i:1] lg:grid-cols-3 lg:gap-3">
					{live.map((href, i) => (
						<AppBox
							key={href}
							href={href}
							index={i}
							span={spanOf(i, live.length)}
							ws={ws}
							today={today}
						/>
					))}
				</ul>
			)}
			{(fresh.length > 0 || hidden.length > 0) && (
				<StartHere apps={fresh} hidden={hidden} all={false} offset={2} />
			)}
		</div>
	);
}

type Box = {
	value: string | null;
	label: string;
	/** Rows this app has on Today's list. */
	count: number;
	late: boolean;
	/** The most pressing of them, in Today's words. */
	top: string | null;
};

async function readBox(href: AppHref, ws: Workspace, today: string): Promise<Box> {
	const [[value, label], agenda] = await Promise.all([
		figureOf(href, ws, today),
		loadAgenda(ws, today),
	]);
	const items = buildQueue(agenda, today).filter((i) => i.app === href);
	return {
		value,
		label,
		count: items.length,
		late: items.some((i) => i.tone === "overdue"),
		top: items[0]?.title ?? null,
	};
}

function AppBox({
	href,
	index,
	span,
	ws,
	today,
}: {
	href: AppHref;
	index: number;
	span: string;
	ws: Workspace;
	today: string;
}) {
	const app = APPS_CONFIG[href];
	const lead = index === 0;
	return (
		<li className={cn(app.theme, "min-w-0", span)}>
			<Link
				href={href}
				prefetch
				aria-keyshortcuts={index < 7 ? String(index + 1) : undefined}
				className="group relative isolate flex h-full min-h-36 flex-col overflow-hidden rounded-group bg-surface p-4 outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] motion-reduce:active:scale-100 lg:min-h-44 lg:p-5"
			>
				<span
					aria-hidden
					className="pointer-events-none absolute -right-2 -bottom-5 -z-10 select-none text-[6.5rem] leading-none font-bold text-primary/10 transition-[color,transform] duration-200 ease-out group-hover:-translate-y-1 group-hover:text-primary/15 motion-reduce:group-hover:translate-y-0 sm:-right-3 sm:-bottom-8 sm:text-[8.5rem] lg:text-[10rem]"
				>
					{app.kanji}
				</span>
				<span className="flex min-w-0 items-baseline gap-2 text-sm font-medium">
					<span aria-hidden className="text-primary">
						{app.kanji}
					</span>
					<span className="truncate">
						{app.name}
						<span className={cn("text-muted-foreground", !lead && "max-sm:hidden")}>
							{" "}
							· {app.label}
						</span>
					</span>
				</span>
				<Suspense fallback={<BoxBody lead={lead} value={null} label="" />}>
					<Filled href={href} lead={lead} ws={ws} today={today} />
				</Suspense>
			</Link>
		</li>
	);
}

async function Filled({
	href,
	lead,
	ws,
	today,
}: {
	href: AppHref;
	lead: boolean;
	ws: Workspace;
	today: string;
}) {
	const box = await readBox(href, ws, today);
	return <BoxBody lead={lead} {...box} />;
}

function BoxBody({
	lead,
	value,
	label,
	top = null,
	count = 0,
	late = false,
}: Partial<Box> & { lead: boolean; value: string | null; label: string }) {
	return (
		<span className="mt-auto flex min-w-0 flex-col pt-6">
			<span
				className={cn(
					"truncate font-figures font-semibold tracking-tight tabular-nums",
					lead ? "text-4xl lg:text-5xl" : "text-3xl lg:text-4xl",
					value == null && "text-muted-foreground/40",
				)}
			>
				{value ?? "—"}
			</span>
			<span className="min-h-4 truncate text-xs text-muted-foreground">{label}</span>
			<span
				className={cn(
					"mt-2 flex min-h-4 min-w-0 items-center gap-1.5 text-xs",
					late ? "text-negative" : "text-muted-foreground",
				)}
			>
				{top && (
					<>
						<span
							aria-hidden
							className={cn(
								"size-1.5 shrink-0 rounded-full",
								late ? "bg-negative" : "bg-muted-foreground/60",
							)}
						/>
						<span className="truncate">
							{top}
							{count > 1 && ` · +${count - 1} more`}
						</span>
					</>
				)}
			</span>
		</span>
	);
}
