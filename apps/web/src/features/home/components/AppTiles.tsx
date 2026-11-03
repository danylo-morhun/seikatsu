import Link from "next/link";
import { Suspense } from "react";
import {
	type AppHref,
	TileAction,
	TileBody,
	TileBodySkeleton,
	TileFrame,
} from "@/features/home/components/Tile";
import { HabitsToday, LogMileage, LogPages } from "@/features/home/components/TodayIslands";
import { km, money, plural } from "@/features/home/lib/format";
import {
	loadCar,
	loadCards,
	loadHabits,
	loadJobs,
	loadMoney,
	loadReading,
	loadWants,
} from "@/features/home/lib/today";
import { LazyAddTransactionModal } from "@/features/kuroji/components/LazyAddTransactionModal";
import { ProgressMeter } from "@/features/tsundoku/components/ProgressMeter";
import type { Workspace } from "@/lib/session";

interface Props {
	apps: readonly AppHref[];
	ws: Workspace;
	today: string;
	/** Stagger after the tiles above. */
	start: number;
}

/** A zone's tiles, the home's and the zone page's: small ones first, then the lists; the odd
 * small one takes two columns, so the grid has no hole. */
export function ZoneTiles({ apps, ws, today, start }: Props) {
	const smalls = apps.filter((href) => !TILES[href].wide);
	const wides = apps.filter((href) => TILES[href].wide);
	const fill = smalls.length % 2 === 1 ? smalls.at(-1) : undefined;
	return (
		<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			{[...smalls, ...wides].map((href, i) => {
				const { wide, action, Body } = TILES[href];
				return (
					<TileFrame
						key={href}
						href={href}
						index={start + i}
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
