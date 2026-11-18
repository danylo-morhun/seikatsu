"use client";

import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/PageTitle";
import { Spinner } from "@/components/Spinner";
import { LaterMenu } from "@/features/day/components/LaterMenu";
import { Steps } from "@/features/day/components/Steps";
import { laterDays } from "@/features/day/lib/day";
import { clearDue, close, drop, putOff, shortDay } from "@/features/day/lib/offline";
import { QUEUED_TOAST } from "@/features/pwa/lib/run";
import { APPS_CONFIG } from "@/lib/app-themes";
import { pageKey } from "@/lib/capture-shortcut";

/** Something the day didn't finish: a pick, or a card due by today. */
export type LeftRow = {
	key: string;
	title: string;
	note: string;
	app: string;
	cardId: string | null;
	/** On today's plan: Drop takes it off, so it isn't carried. */
	picked: boolean;
};

type Step = 0 | 1 | 2;
type Choice = "tomorrow" | "later" | "drop";

const seal = (app: string) =>
	app in APPS_CONFIG ? APPS_CONFIG[app as keyof typeof APPS_CONFIG] : { theme: "", kanji: "志" };

const FAILED = { error: "Couldn't save. Check your connection." };

/**
 * The evening: log what the day piled up, sort what it didn't finish (nothing rolls over by
 * itself), then a look at tomorrow and the close. Closing quiets Today until the morning.
 */
export function EveningFlow({
	today,
	closed: wasClosed,
	planned,
	habits,
	payments,
	left,
	tomorrow,
	log,
}: {
	today: string;
	closed: boolean;
	planned: { done: number; of: number } | null;
	habits: { done: number; of: number };
	payments: number;
	left: LeftRow[];
	tomorrow: { key: string; time: string | null; title: string }[];
	/** Step one, rendered on the server: habits, pages, the odometer, payments. */
	log: React.ReactNode;
}) {
	const [step, setStep] = useState<Step>(wasClosed ? 2 : 0);
	const [closed, setClosed] = useState(wasClosed);
	const [choice, setChoice] = useState<Record<string, Choice>>({});
	const [closing, startClosing] = useTransition();
	const next = laterDays(today).tomorrow;

	const choose = (key: string, value: Choice | undefined) =>
		setChoice((prev) => {
			const out = { ...prev };
			if (value) out[key] = value;
			else delete out[key];
			return out;
		});

	async function sort(row: LeftRow, value: Choice, until?: string) {
		const before = choice[row.key];
		choose(row.key, value);
		const back = () => choose(row.key, before);
		if (value === "tomorrow" || value === "later") {
			const day = until ?? next;
			// A card moves its date; a pick with none simply waits in tomorrow's pick.
			if (row.cardId || value === "later")
				await putOff(
					{ key: row.key, title: row.title, cardId: row.cardId ?? undefined },
					day,
					back,
				);
			else toast("In tomorrow's pick", { description: row.title });
			return;
		}
		const result = await (async () => {
			if (row.cardId) {
				const r = await clearDue({ cardId: row.cardId, title: row.title });
				if ("error" in r || !row.picked) return r;
			}
			return row.picked
				? drop(today, { key: row.key, title: row.title, href: "/", app: row.app })
				: { success: true as const };
		})().catch(() => FAILED);
		if ("error" in result) {
			toast.error(result.error);
			back();
		} else if ("queued" in result) toast(QUEUED_TOAST);
	}

	function finish() {
		startClosing(async () => {
			const result = await close(today).catch(() => FAILED);
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			if ("queued" in result) toast(QUEUED_TOAST);
			setClosed(true);
		});
	}

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "]" && step < 2) {
				e.preventDefault();
				setStep((s) => (s + 1) as Step);
			} else if (k === "[" && step > 0 && !closed) {
				e.preventDefault();
				setStep((s) => (s - 1) as Step);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [step, closed]);

	const carried = left.filter((r) => {
		const c = choice[r.key];
		return r.picked ? c === undefined || c === "tomorrow" : c === "tomorrow";
	});

	return (
		<div className="theme-keizoku mx-auto w-full max-w-2xl px-4 pt-5 pb-28 sm:px-8 md:py-8">
			<Steps step={step} of={3} />

			{step === 0 && (
				<>
					<PageTitle
						title="How did today go?"
						subtitle="Log what piled up. Skip anything that didn't happen."
					/>
					{log}
					<Footer>
						<span />
						<Button onClick={() => setStep(1)} aria-keyshortcuts="]">
							Next · what's left
						</Button>
					</Footer>
				</>
			)}

			{step === 1 && (
				<>
					<PageTitle
						title="What's left"
						subtitle={
							left.length > 0
								? "Nothing rolls over by itself. Tomorrow puts it in the morning's pick."
								: "Nothing left over. Well done."
						}
					/>
					{planned && (
						<p className="mb-4 rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-3 text-sm">
							<span className="font-figures text-lg font-semibold tabular-nums text-primary">
								{planned.done}/{planned.of}
							</span>{" "}
							<span className="text-muted-foreground">of my day done</span>
						</p>
					)}
					{left.length > 0 && (
						<ul aria-label="What's left" className="inset-group">
							{left.map((row) => (
								<LeftItem
									key={row.key}
									row={row}
									today={today}
									choice={choice[row.key]}
									onTomorrow={() => sort(row, "tomorrow")}
									onLater={(until) => sort(row, "later", until)}
									onDrop={() => sort(row, "drop")}
								/>
							))}
						</ul>
					)}
					<Footer>
						<Button variant="ghost" onClick={() => setStep(0)} aria-keyshortcuts="[">
							Back
						</Button>
						<Button onClick={() => setStep(2)} aria-keyshortcuts="]">
							Next · tomorrow
						</Button>
					</Footer>
				</>
			)}

			{step === 2 && (
				<>
					<PageTitle
						title={closed ? "Day closed" : "Tomorrow"}
						subtitle={closed ? "Quiet until the morning." : shortDay(next)}
					/>
					<div className="mb-6 grid grid-cols-3 gap-2">
						<Figure value={planned ? `${planned.done}/${planned.of}` : "—"} label="my day" />
						<Figure value={`${habits.done}/${habits.of}`} label="habits" />
						<Figure value={String(payments)} label="payments to add" />
					</div>
					<h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">{shortDay(next)}</h2>
					{tomorrow.length + carried.length === 0 ? (
						<p className="rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-4 text-sm text-muted-foreground">
							Nothing dated yet. The morning picks the day.
						</p>
					) : (
						<ul aria-label="Tomorrow" className="inset-group">
							{tomorrow.map((t) => (
								<li key={t.key} className="flex min-h-12 items-center gap-3 py-2">
									<span className="w-11 shrink-0 font-figures text-xs tabular-nums text-muted-foreground">
										{t.time ?? "—"}
									</span>
									<span className="truncate text-sm">{t.title}</span>
								</li>
							))}
							{carried
								.filter((r) => !r.cardId)
								.map((r) => (
									<li key={r.key} className="flex min-h-12 items-center gap-3 py-2">
										<span className="w-11 shrink-0 text-xs text-muted-foreground">pick</span>
										<span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
										<span className="text-xs text-muted-foreground">carried</span>
									</li>
								))}
						</ul>
					)}
					<Footer>
						{closed ? (
							<span />
						) : (
							<Button variant="ghost" onClick={() => setStep(1)} aria-keyshortcuts="[">
								Back
							</Button>
						)}
						{closed ? (
							<Button asChild variant="outline">
								<Link href="/" prefetch>
									Today
								</Link>
							</Button>
						) : (
							<Button onClick={finish} disabled={closing} className="gap-1.5">
								{closing && <Spinner />}
								{closing ? "Closing…" : "Close the day"}
							</Button>
						)}
					</Footer>
				</>
			)}
		</div>
	);
}

function Footer({ children }: { children: React.ReactNode }) {
	return <div className="mt-6 flex items-center justify-between gap-3">{children}</div>;
}

function Figure({ value, label }: { value: string; label: string }) {
	return (
		<div className="rounded-group bg-[var(--group-bg)] px-3 py-2.5">
			<p className="font-figures text-lg font-semibold tabular-nums">{value}</p>
			<p className="text-xs text-muted-foreground">{label}</p>
		</div>
	);
}

const CHOSEN: Record<Choice, string> = {
	tomorrow: "Tomorrow",
	later: "Later",
	drop: "Dropped",
};

function LeftItem({
	row,
	today,
	choice,
	onTomorrow,
	onLater,
	onDrop,
}: {
	row: LeftRow;
	today: string;
	choice: Choice | undefined;
	onTomorrow: () => void;
	onLater: (until: string) => void;
	onDrop: () => void;
}) {
	const app = seal(row.app);
	return (
		<li className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 py-2">
			<span
				aria-hidden
				className={cn(
					app.theme,
					"flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[13px] font-semibold text-primary",
				)}
			>
				{app.kanji}
			</span>
			<div className={cn("min-w-0 flex-1", choice && "opacity-60")}>
				<p className={cn("truncate text-sm font-medium", choice === "drop" && "line-through")}>
					{row.title}
				</p>
				<p className="truncate text-xs text-muted-foreground">
					{choice ? CHOSEN[choice] : row.note}
				</p>
			</div>
			{!choice && (
				<div className="flex shrink-0 items-center gap-1">
					<Button variant="outline" size="sm" onClick={onTomorrow}>
						Tomorrow
					</Button>
					<LaterMenu title={row.title} today={today} onPick={onLater} />
					<Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onDrop}>
						Drop
					</Button>
				</div>
			)}
		</li>
	);
}
