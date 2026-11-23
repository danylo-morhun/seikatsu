// The home's widgets, server side: each app's box (its figure, what waits in it, the one quick
// act) and the cross-app To do. A small widget is one link into its app; a medium or large one
// adds the rows, each with its own act, and a header that opens the app.

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { DayBody } from "@/features/day/components/DayBody";
import { LineSkeleton } from "@/features/home/components/Line";
import { TodayQueue } from "@/features/home/components/TodayQueue";
import { CarLine, figureOf, Habits, ReadingLine } from "@/features/home/components/TodayView";
import { AddExpense } from "@/features/home/components/WidgetActions";
import { loadAgenda } from "@/features/home/lib/agenda";
import type { WidgetId, WidgetSize } from "@/features/home/lib/dashboard";
import { money } from "@/features/home/lib/format";
import { buildQueue, type QueueItem } from "@/features/home/lib/queue";
import { loadMoney, type Started } from "@/features/home/lib/today";
import { formatMoney } from "@/features/hoshii/lib/format";
import { APPS_CONFIG } from "@/lib/app-themes";
import type { AppHref, ModuleHref } from "@/lib/modules";
import type { Workspace } from "@/lib/session";

const asMoney = (amount: number, currency: string) => formatMoney(amount, currency, true);

/** Rows a widget shows before "Show more". */
const ROWS: Record<WidgetSize, number> = { s: 0, m: 3, l: 6 };

interface Ctx {
	ws: Workspace;
	today: string;
	on: readonly ModuleHref[];
	started: Started;
}

/** One widget's content at its size; the grid around it is the client's (Dashboard). */
export function Widget({ id, size, ...ctx }: Ctx & { id: WidgetId; size: WidgetSize }) {
	if (id === "today") return <TodayWidget {...ctx} />;
	if (ctx.started[id] === false) return <FreshWidget href={id} size={size} />;
	return size === "s" ? (
		<SmallWidget href={id} {...ctx} />
	) : (
		<BigWidget href={id} size={size} {...ctx} />
	);
}

// ── Small: the figure and the most pressing thing ─────────────────────────────────────────

function SmallWidget({ href, ws, today }: Ctx & { href: AppHref }) {
	const app = APPS_CONFIG[href];
	return (
		<Link
			href={href}
			prefetch
			className={cn(
				app.theme,
				"group relative isolate flex h-full min-h-36 flex-col overflow-hidden rounded-group bg-surface p-4 outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] motion-reduce:active:scale-100 lg:min-h-40",
			)}
		>
			<Watermark kanji={app.kanji} />
			<Name href={href} />
			<Suspense fallback={<Figure value={null} label="" />}>
				<SmallBody href={href} ws={ws} today={today} />
			</Suspense>
		</Link>
	);
}

async function SmallBody({ href, ws, today }: { href: AppHref; ws: Workspace; today: string }) {
	const [[value, label], items] = await Promise.all([
		figureOf(href, ws, today),
		itemsOf(href, ws, today),
	]);
	const top = items[0];
	const late = items.some((i) => i.tone === "overdue");
	return (
		<span className="mt-auto flex min-w-0 flex-col pt-6">
			<Figure value={value} label={label} />
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
							{top.title}
							{items.length > 1 && ` · +${items.length - 1} more`}
						</span>
					</>
				)}
			</span>
		</span>
	);
}

// ── Medium and large: the figure, then the rows with their acts ───────────────────────────

function BigWidget({ href, size, ...ctx }: Ctx & { href: AppHref; size: WidgetSize }) {
	const app = APPS_CONFIG[href];
	return (
		<section
			aria-label={app.name}
			className={cn(
				app.theme,
				"relative isolate flex h-full min-h-36 flex-col overflow-hidden rounded-group bg-surface p-4 lg:min-h-40",
			)}
		>
			<Header
				href={href}
				action={
					href === "/kuroji" ? (
						<AddExpense ws={{ id: ctx.ws.id, baseCurrency: ctx.ws.baseCurrency }} />
					) : null
				}
			/>
			<Suspense fallback={<RowsSkeleton />}>
				<BigBody href={href} rows={ROWS[size]} {...ctx} />
			</Suspense>
		</section>
	);
}

async function BigBody({ href, rows, ws, today }: Ctx & { href: AppHref; rows: number }) {
	const items = await itemsOf(href, ws, today);
	const queue = (
		<TodayQueue
			items={items}
			workspaceId={ws.id}
			today={today}
			limit={rows}
			inWidget
			label={`Waiting in ${APPS_CONFIG[href].name}`}
		/>
	);
	switch (href) {
		case "/kuroji":
			return (
				<>
					<MoneyFigures ws={ws} today={today} />
					{items.length > 0 && queue}
				</>
			);
		case "/keizoku":
			return (
				<div className="mt-3">
					<Habits />
				</div>
			);
		case "/tsundoku":
			return (
				<ul className="mt-1">
					<ReadingLine seal={false} />
				</ul>
			);
		case "/aisha":
			return (
				<>
					<ul className="mt-1">
						<CarLine today={today} seal={false} />
					</ul>
					{items.length > 0 && queue}
				</>
			);
		default: {
			const [value, label] = await figureOf(href, ws, today);
			return (
				<>
					<p className="mt-3 flex items-baseline gap-2">
						<span className="font-figures text-2xl font-semibold tracking-tight tabular-nums">
							{value ?? "—"}
						</span>
						<span className="text-xs text-muted-foreground">{label}</span>
					</p>
					{queue}
				</>
			);
		}
	}
}

async function MoneyFigures({ ws, today }: { ws: Workspace; today: string }) {
	const m = await loadMoney(ws, today);
	if (!m) return <p className="mt-3 text-sm text-muted-foreground">Couldn't read the money.</p>;
	return (
		<dl className="mt-3 grid grid-cols-3 gap-3">
			<Stat label="This month" value={money(m.spentThisMonth, m.currency)} lead />
			<Stat label="Today" value={money(m.spentToday, m.currency)} />
			<Stat label="Net worth" value={money(m.netWorth, m.currency)} />
		</dl>
	);
}

function Stat({ label, value, lead = false }: { label: string; value: string; lead?: boolean }) {
	return (
		<div className="min-w-0">
			<dt className="truncate text-xs text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					"truncate font-figures font-semibold tracking-tight tabular-nums",
					lead ? "text-2xl" : "text-base",
				)}
			>
				{value}
			</dd>
		</div>
	);
}

// ── An app with nothing in it yet ─────────────────────────────────────────────────────────

function FreshWidget({ href, size }: { href: AppHref; size: WidgetSize }) {
	const app = APPS_CONFIG[href];
	return (
		<Link
			href={href}
			prefetch
			className={cn(
				app.theme,
				"group relative isolate flex h-full min-h-36 flex-col overflow-hidden rounded-group bg-surface p-4 outline-none transition-colors duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring lg:min-h-40",
			)}
		>
			<Watermark kanji={app.kanji} />
			<Name href={href} />
			<span className={cn("mt-auto pt-6 text-sm", size === "s" && "line-clamp-2")}>
				{app.pitch}
			</span>
			<span className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
				Start
				<HugeiconsIcon
					icon={ArrowRight01Icon}
					className="size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
				/>
			</span>
		</Link>
	);
}

// ── To do across the apps (My day when Day is on) ─────────────────────────────────────────

function TodayWidget({ ws, today, on, started }: Ctx) {
	const day = on.includes("/day");
	const habits = on.includes("/keizoku") && started["/keizoku"] !== false;
	return (
		<section aria-label={day ? "My day" : "To do"} className="h-full min-w-0">
			<h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
				{day ? "My day" : "To do"}
			</h2>
			<Suspense fallback={<RowsSkeleton group />}>
				{day ? (
					<DayBody ws={ws} today={today} fmt={asMoney} showHabits={habits} />
				) : (
					<AllRows ws={ws} today={today} />
				)}
			</Suspense>
		</section>
	);
}

async function AllRows({ ws, today }: { ws: Workspace; today: string }) {
	const items = buildQueue(await loadAgenda(ws, today), today, asMoney);
	return <TodayQueue items={items} workspaceId={ws.id} today={today} />;
}

// ── Parts ─────────────────────────────────────────────────────────────────────────────────

/** What waits on the user in one app, in To do's words and order. */
async function itemsOf(href: AppHref, ws: Workspace, today: string): Promise<QueueItem[]> {
	return buildQueue(await loadAgenda(ws, today), today, asMoney).filter((i) => i.app === href);
}

function Name({ href }: { href: AppHref }) {
	const app = APPS_CONFIG[href];
	return (
		<span className="flex min-w-0 items-baseline gap-2 text-sm font-medium">
			<span aria-hidden className="text-primary">
				{app.kanji}
			</span>
			<span className="truncate">
				{app.name}
				<span className="text-muted-foreground max-sm:hidden"> · {app.label}</span>
			</span>
		</span>
	);
}

/** A big widget's header: the app's name opens it; its quick act sits on the right. */
function Header({ href, action }: { href: AppHref; action: ReactNode }) {
	return (
		<div className="flex min-h-8 items-center gap-2">
			<Link
				href={href}
				prefetch
				className="group -mx-1.5 flex min-w-0 items-center gap-1 rounded-button px-1.5 py-1 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
			>
				<Name href={href} />
				<HugeiconsIcon
					icon={ArrowRight01Icon}
					className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5"
				/>
			</Link>
			{action && <div className="ml-auto shrink-0">{action}</div>}
		</div>
	);
}

function Figure({ value, label }: { value: string | null; label: string }) {
	return (
		<>
			<span
				className={cn(
					"truncate font-figures text-3xl font-semibold tracking-tight tabular-nums lg:text-4xl",
					value == null && "text-muted-foreground/40",
				)}
			>
				{value ?? "—"}
			</span>
			<span className="min-h-4 truncate text-xs text-muted-foreground">{label}</span>
		</>
	);
}

function Watermark({ kanji }: { kanji: string }) {
	return (
		<span
			aria-hidden
			className="pointer-events-none absolute -right-3 -bottom-8 -z-10 select-none text-[8.5rem] leading-none font-bold text-primary/[0.07]"
		>
			{kanji}
		</span>
	);
}

const SKELETON_ROWS = ["a", "b", "c"];

function RowsSkeleton({ group = false }: { group?: boolean }) {
	return (
		<ul className={group ? "inset-group" : "mt-2"}>
			{SKELETON_ROWS.map((key) => (
				<LineSkeleton key={key} />
			))}
		</ul>
	);
}
