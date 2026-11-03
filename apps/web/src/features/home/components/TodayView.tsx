import Link from "next/link";
import { Suspense } from "react";
import { StartHere } from "@/features/home/components/StartHere";
import {
	type AppHref,
	TileAction,
	TileBody,
	TileBodySkeleton,
	TileFrame,
} from "@/features/home/components/Tile";
import {
	Greeting,
	HabitsToday,
	HomeKeys,
	LogMileage,
	LogPages,
} from "@/features/home/components/TodayIslands";
import { km, longDate, money, plural } from "@/features/home/lib/format";
import {
	loadCar,
	loadCards,
	loadHabits,
	loadJobs,
	loadMoney,
	loadReading,
	loadWants,
	type Started,
} from "@/features/home/lib/today";
import { LazyAddTransactionModal } from "@/features/kuroji/components/LazyAddTransactionModal";
import { ProgressMeter } from "@/features/tsundoku/components/ProgressMeter";
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
					// Small tiles first, then the lists; the odd small one takes two columns, so no hole.
					const smalls = zone.apps.filter((href) => !TILES[href].wide);
					const wides = zone.apps.filter((href) => TILES[href].wide);
					const fill = smalls.length % 2 === 1 ? smalls.at(-1) : undefined;
					return (
						<section key={zone.id} aria-labelledby={`zone-${zone.id}`} className="space-y-2">
							<h2
								id={`zone-${zone.id}`}
								className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground"
							>
								<span aria-hidden>{zone.kanji}</span>
								{zone.name}
							</h2>
							<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
								{[...smalls, ...wides].map((href) => {
									const { wide, action, Body } = TILES[href];
									return (
										<TileFrame
											key={href}
											href={href}
											index={tile++}
											wide={wide}
											fill={fill === href}
											action={action}
										>
											<Suspense fallback={<TileBodySkeleton action={action && !wide} />}>
												<Body ws={ws} today={today} />
											</Suspense>
										</TileFrame>
									);
								})}
							</div>
						</section>
					);
				})}

			{(fresh.length > 0 || hidden.length > 0) && (
				<StartHere apps={fresh} hidden={hidden} all={isNew} offset={isNew ? 1 : tile} />
			)}
		</div>
	);
}

// ── Tiles ─────────────────────────────────────────────────────────────────────

type BodyProps = { ws: Workspace; today: string };

/** Each app's tile: a wide one carries a list; `action` leaves room for its corner capture. */
const TILES: Record<
	AppHref,
	{ wide?: boolean; action?: boolean; Body: (props: BodyProps) => Promise<React.ReactNode> }
> = {
	"/kuroji": { action: true, Body: KurojiBody },
	"/hoshii": { Body: HoshiiBody },
	"/seiryu": { Body: SeiryuBody },
	"/kyuu": { Body: KyuuBody },
	"/aisha": { action: true, Body: AishaBody },
	"/keizoku": { wide: true, Body: KeizokuBody },
	"/tsundoku": { wide: true, action: true, Body: TsundokuBody },
};

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

// ── Tile bodies ───────────────────────────────────────────────────────────────

async function KurojiBody({ ws, today }: { ws: Workspace; today: string }) {
	const m = await loadMoney(ws, today);
	return (
		<TileBody
			negative={(m?.netWorth ?? 0) < 0}
			value={m ? money(m.netWorth, m.currency) : null}
			note={m ? `Net worth · ${money(m.spentThisMonth, m.currency)} spent` : "Not set up"}
			action={
				<LazyAddTransactionModal
					workspaceId={ws.id}
					baseCurrency={ws.baseCurrency}
					shortcut
					trigger={
						<TileAction label="Add transaction" keys="N">
							Add
						</TileAction>
					}
				/>
			}
		/>
	);
}

async function AishaBody({ today }: { today: string }) {
	const car = await loadCar(today);
	const next = car?.next;
	return (
		<TileBody
			value={
				next?.kmLeft != null
					? km(next.kmLeft)
					: next?.daysLeft != null
						? plural(Math.abs(next.daysLeft), "day")
						: car
							? km(car.currentKm)
							: null
			}
			note={
				!car
					? "Not set up"
					: !next
						? "on the odometer"
						: next.status === "overdue"
							? `${next.name} overdue`
							: `to ${next.name}`
			}
			alert={next?.status === "overdue"}
			action={car && <LogMileage vehicleId={car.vehicleId} currentKm={car.currentKm} />}
		/>
	);
}

async function SeiryuBody({ ws, today }: { ws: Workspace; today: string }) {
	const cards = (await loadCards(ws, today)) ?? [];
	const overdue = cards.filter((c) => c.dueDate < today).length;
	return (
		<TileBody
			value={String(cards.length)}
			note={
				overdue > 0
					? `${plural(overdue, "card")} overdue`
					: cards.length > 0
						? "cards due today"
						: "No cards due"
			}
			alert={overdue > 0}
		/>
	);
}

async function KyuuBody() {
	const jobs = await loadJobs();
	return (
		<TileBody
			value={jobs ? String(jobs.toSend) : null}
			note={
				jobs
					? jobs.ghostDue > 0
						? `to send · ${jobs.ghostDue} to close`
						: `to send · ${jobs.waiting} waiting`
					: null
			}
		/>
	);
}

async function HoshiiBody({ ws, today }: { ws: Workspace; today: string }) {
	const wants = await loadWants(ws, today);
	return (
		<TileBody
			value={
				wants
					? String(
							wants.decide > 0 ? wants.decide : wants.canBuy > 0 ? wants.canBuy : wants.cooling,
						)
					: null
			}
			note={
				!wants
					? null
					: wants.decide > 0
						? `to decide${wants.canBuy > 0 ? ` · ${wants.canBuy} can buy` : ""}`
						: wants.canBuy > 0
							? `can buy · ${wants.nextBuy}`
							: `cooling · ${wants.plan} in the Plan`
			}
		/>
	);
}

async function KeizokuBody({ today }: { today: string }) {
	const data = await loadHabits();
	const habits = data?.habits ?? [];
	const left = habits.filter((h) => !h.done).length;
	// Undone first: the tile shows what's left, then what's ticked.
	const habitList = [...habits].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 4);
	return (
		<TileBody
			value={habits.length > 0 ? `${habits.length - left} / ${habits.length}` : null}
			note={
				habits.length === 0
					? "Nothing due today"
					: left === 0
						? "All done today"
						: `${left} left today`
			}
		>
			{habitList.length > 0 && <HabitsToday habits={habitList} today={data?.today ?? today} />}
			{habits.length > habitList.length && (
				<Link
					href="/keizoku"
					prefetch
					className="mt-1 inline-block text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					{habits.length - habitList.length} more
				</Link>
			)}
		</TileBody>
	);
}

async function TsundokuBody() {
	const book = (await loadReading())?.[0];
	return (
		<TileBody
			value={book ? `p. ${book.currentPage}` : null}
			note={
				book
					? [book.title, book.pageCount && `of ${book.pageCount}`].filter(Boolean).join(" · ")
					: "No book on the go"
			}
			action={book && <LogPages book={book} />}
		>
			{book && (
				<ProgressMeter
					compact
					currentPage={book.currentPage}
					pageCount={book.pageCount}
					daysToFinish={book.daysToFinish}
				/>
			)}
		</TileBody>
	);
}
