import Link from "next/link";
import { Suspense } from "react";
import { ZoneTiles } from "@/features/home/components/AppTiles";
import { StartHere } from "@/features/home/components/StartHere";
import type { AppHref } from "@/features/home/components/Tile";
import { Greeting, HomeKeys } from "@/features/home/components/TodayIslands";
import { longDate, plural } from "@/features/home/lib/format";
import {
	loadCar,
	loadCards,
	loadHabits,
	loadJobs,
	loadWants,
	type Started,
} from "@/features/home/lib/today";
import { APPS_CONFIG } from "@/lib/app-themes";
import type { Workspace } from "@/lib/session";
import { ZONES } from "@/lib/zones";

const APP_HREFS = Object.keys(APPS_CONFIG) as AppHref[];

interface Props {
	ws: Workspace;
	today: string;
	started: Started;
	firstName: string | null;
}

/**
 * The home: the day's date and what's waiting, then one tile per app in use. The layout is
 * known from the start; each tile's figures (and the "waiting" line) stream in on their own.
 */
export function TodayView({ ws, today, started, firstName }: Props) {
	const hidden = APP_HREFS.filter((href) => ws.hiddenApps.includes(href));
	const listed = APP_HREFS.filter((href) => !ws.hiddenApps.includes(href));
	// An app with nothing in it yet waits on the start list, not as a tile of dashes.
	const fresh = listed.filter((href) => started[href] === false);
	const isNew = APP_HREFS.every((href) => started[href] === false);
	const shows = (href: AppHref) => listed.includes(href) && !fresh.includes(href);
	const zones = ZONES.map((zone) => ({ ...zone, apps: zone.apps.filter(shows) })).filter(
		(zone) => zone.apps.length > 0,
	);
	let tile = 0;

	return (
		<div className="space-y-6 px-4 pt-5 pb-16 sm:px-8 md:space-y-8 md:py-8">
			<HomeKeys listed={listed} />
			{isNew ? (
				<header className="max-w-2xl animate-rise">
					<h1 className="text-xl font-semibold tracking-tight md:text-3xl">
						{firstName ? `Welcome, ${firstName}.` : "Welcome."}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground md:text-base">
						生活 — everyday life. Seven small apps for money, projects, books, habits, the job
						search, the car and the things you want, under one sign-in. Start with whichever you
						need; the rest wait here until you do, and each one shows up on this page once it has
						something in it.
					</p>
				</header>
			) : (
				<header className="animate-rise">
					<h1 className="text-xl font-semibold tracking-tight md:text-3xl">{longDate(today)}</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						<Greeting firstName={firstName} />
						{/* Holds the line's height until the summaries are in. */}
						<Suspense fallback={<span className="invisible">Nothing waiting on you today.</span>}>
							<Waiting ws={ws} today={today} />
						</Suspense>
					</p>
				</header>
			)}

			{!isNew &&
				zones.map((zone) => {
					const start = tile;
					tile += zone.apps.length;
					return (
						<section key={zone.id} aria-labelledby={`zone-${zone.id}`} className="space-y-2">
							<h2 id={`zone-${zone.id}`} className="px-1 text-xs font-medium">
								<Link
									href={zone.href}
									prefetch
									className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
								>
									<span aria-hidden>{zone.kanji}</span>
									{zone.name}
								</Link>
							</h2>
							<ZoneTiles apps={zone.apps} ws={ws} today={today} start={start} />
						</section>
					);
				})}

			{(fresh.length > 0 || hidden.length > 0) && (
				<StartHere apps={fresh} hidden={hidden} all={isNew} offset={isNew ? 1 : tile} />
			)}
		</div>
	);
}

// ── What's waiting ────────────────────────────────────────────────────────────

async function Waiting({ ws, today }: { ws: Workspace; today: string }) {
	const [habits, cards, car, jobs, wants] = await Promise.all([
		loadHabits(),
		loadCards(ws, today),
		loadCar(today),
		loadJobs(),
		loadWants(ws, today),
	]);
	const left = (habits?.habits ?? []).filter((h) => !h.done).length;
	const overdue = (cards ?? []).filter((c) => c.dueDate < today).length;
	const attention = [
		left > 0 && `${plural(left, "habit")} left`,
		overdue > 0 && `${plural(overdue, "card")} overdue`,
		car?.next?.status === "overdue" && "car service overdue",
		(jobs?.toSend ?? 0) > 0 && `${jobs?.toSend} to send`,
		(wants?.decide ?? 0) > 0 && `${plural(wants?.decide ?? 0, "want")} to decide`,
	].filter(Boolean);
	return attention.length > 0 ? `${attention.join(", ")}.` : "Nothing waiting on you today.";
}
