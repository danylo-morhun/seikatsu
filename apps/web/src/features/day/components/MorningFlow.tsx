"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { Spinner } from "@/components/Spinner";
import { LaterMenu } from "@/features/day/components/LaterMenu";
import { Steps, StepTitle } from "@/features/day/components/Steps";
import {
	type Candidate,
	type DayPick,
	type FocusPick,
	MAX_PICKS,
	pickCandidates,
} from "@/features/day/lib/day";
import { clearDue, planDay, putOff } from "@/features/day/lib/offline";
import type { QueueItem } from "@/features/home/lib/queue";
import { QUEUED_TOAST } from "@/features/pwa/lib/run";
import { projectOfHref } from "@/features/week/lib/rhythm";
import { APPS_CONFIG } from "@/lib/app-themes";
import { pageKey } from "@/lib/capture-shortcut";

type Step = "sort" | "pick";

const seal = (app: string) =>
	app in APPS_CONFIG ? APPS_CONFIG[app as keyof typeof APPS_CONFIG] : { theme: "", kanji: "志" };

/**
 * The morning: first what waits, each kept for today or put off (a card moves its own date);
 * then up to three things for the day, from yesterday's leftovers, the list and cards already
 * under way. Saving opens Today with them on top.
 */
export function MorningFlow({
	today,
	items,
	focus,
	carried,
	weekFocus,
	goals,
	picked,
	startOnPick,
}: {
	today: string;
	items: QueueItem[];
	focus: FocusPick[];
	carried: DayPick[];
	/** The week's focus not done yet: offered after yesterday's leftovers. */
	weekFocus: DayPick[];
	/** Goals' projects, by project id → goal name: a candidate from one shows its goal. */
	goals: Record<string, string>;
	/** Today's picks when the day is already planned (picking again). */
	picked: string[] | null;
	startOnPick: boolean;
}) {
	const router = useRouter();
	const [step, setStep] = useState<Step>(startOnPick || items.length === 0 ? "pick" : "sort");
	const [gone, setGone] = useState<Set<string>>(new Set());
	const left = useMemo(() => items.filter((i) => !gone.has(i.key)), [items, gone]);

	const candidates = useMemo(
		() => pickCandidates(left, focus, carried, weekFocus),
		[left, focus, carried, weekFocus],
	);
	// Picked before, else yesterday's leftovers, up to the day's room.
	const [chosen, setChosen] = useState<string[]>(() =>
		(picked ?? carried.map((c) => c.key)).slice(0, MAX_PICKS),
	);
	const [saving, startSaving] = useTransition();

	const hide = (key: string) => setGone((prev) => new Set(prev).add(key));
	const show = (key: string) =>
		setGone((prev) => {
			const next = new Set(prev);
			next.delete(key);
			return next;
		});

	function toggle(key: string) {
		setChosen((prev) =>
			prev.includes(key)
				? prev.filter((k) => k !== key)
				: prev.length < MAX_PICKS
					? [...prev, key]
					: prev,
		);
	}

	function start() {
		const byKey = new Map(candidates.map((c) => [c.key, c]));
		const picks = chosen.flatMap((k) => {
			const c = byKey.get(k);
			return c ? [{ key: c.key, title: c.title, href: c.href, app: c.app }] : [];
		});
		startSaving(async () => {
			const result = await planDay(today, picks).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			if ("queued" in result) toast(QUEUED_TOAST);
			startNavigationProgress();
			router.push("/");
		});
	}

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "]" && step === "sort") {
				e.preventDefault();
				setStep("pick");
			} else if (k === "[" && step === "pick" && items.length > 0) {
				e.preventDefault();
				setStep("sort");
			} else if (step === "pick" && k && /^[1-9]$/.test(k)) {
				const c = candidates[Number(k) - 1];
				if (!c) return;
				e.preventDefault();
				toggle(c.key);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	return (
		<div className="mx-auto w-full max-w-2xl px-4 pt-5 pb-28 sm:px-8 md:py-8">
			<Steps step={step === "sort" ? 0 : 1} of={2} />
			{step === "sort" ? (
				<>
					<StepTitle
						title="Good morning"
						subtitle={
							left.length > 0
								? `${left.length} waiting. Keep what's for today, put off the rest.`
								: "Nothing left waiting."
						}
					/>
					{left.length > 0 && (
						<ul aria-label="Waiting" className="inset-group">
							{left.map((item) => (
								<SortRow
									key={item.key}
									item={item}
									today={today}
									onLater={(until) => {
										hide(item.key);
										setChosen((prev) => prev.filter((k) => k !== item.key));
										void putOff(item, until, () => show(item.key));
									}}
									onNoDate={
										item.cardId
											? () => {
													hide(item.key);
													const cardId = item.cardId as string;
													void clearDue({ cardId, title: item.title }).then((r) => {
														if ("error" in r) {
															toast.error(r.error);
															show(item.key);
														}
													});
												}
											: undefined
									}
								/>
							))}
						</ul>
					)}
					<div className="mt-6 flex justify-end">
						<Button onClick={() => setStep("pick")} aria-keyshortcuts="]">
							Next · pick today's {MAX_PICKS}
						</Button>
					</div>
				</>
			) : (
				<>
					<StepTitle
						title={`Today's ${MAX_PICKS}`}
						subtitle="If only these get done, the day counts."
					/>
					<Slots chosen={chosen} candidates={candidates} />
					{candidates.length === 0 ? (
						<p className="mt-4 rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-4 text-sm text-muted-foreground">
							Nothing to pick from. Start the day; anything new goes in Capture.
						</p>
					) : (
						<ul aria-label="Pick up to three" className="mt-4 inset-group">
							{candidates.map((c, i) => (
								<PickRow
									key={c.key}
									candidate={c}
									index={i}
									place={chosen.indexOf(c.key)}
									full={chosen.length >= MAX_PICKS}
									goal={goals[projectOfHref(c.href) ?? ""] ?? null}
									onToggle={() => toggle(c.key)}
								/>
							))}
						</ul>
					)}
					<div className="mt-6 flex items-center justify-between gap-3">
						{items.length > 0 ? (
							<Button variant="ghost" onClick={() => setStep("sort")} aria-keyshortcuts="[">
								Back
							</Button>
						) : (
							<Link
								href="/"
								prefetch
								className="text-sm text-muted-foreground hover:text-foreground"
							>
								Skip
							</Link>
						)}
						<Button onClick={start} disabled={saving} className="gap-1.5">
							{saving && <Spinner />}
							{saving ? "Saving…" : "Start the day"}
						</Button>
					</div>
				</>
			)}
		</div>
	);
}

function SortRow({
	item,
	today,
	onLater,
	onNoDate,
}: {
	item: QueueItem;
	today: string;
	onLater: (until: string) => void;
	onNoDate?: () => void;
}) {
	const app = seal(item.app);
	return (
		<li className="flex min-h-14 items-center gap-3 py-2">
			<span
				aria-hidden
				className={cn(
					app.theme,
					"flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[13px] font-semibold text-primary",
				)}
			>
				{app.kanji}
			</span>
			<Link href={item.href} prefetch className="group min-w-0 flex-1 outline-none">
				<span className="block truncate text-sm font-medium group-hover:underline">
					{item.title}
				</span>
				<span
					className={cn(
						"block truncate text-xs",
						item.tone === "overdue" ? "text-negative" : "text-muted-foreground",
					)}
				>
					{item.note}
				</span>
			</Link>
			<LaterMenu title={item.title} today={today} onPick={onLater} onNoDate={onNoDate} />
		</li>
	);
}

function Slots({ chosen, candidates }: { chosen: string[]; candidates: Candidate[] }) {
	const byKey = new Map(candidates.map((c) => [c.key, c]));
	return (
		<ol aria-label="Picked" className="grid grid-cols-3 gap-2">
			{Array.from({ length: MAX_PICKS }, (_, i) => {
				const c = byKey.get(chosen[i] ?? "");
				return (
					<li
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
						key={i}
						className={cn(
							"min-h-16 rounded-field px-3 py-2",
							c ? "bg-[var(--group-bg)]" : "border border-dashed border-border",
						)}
					>
						<span className="block font-figures text-xs text-muted-foreground">{i + 1}</span>
						<span className={cn("line-clamp-2 text-xs font-medium", !c && "text-muted-foreground")}>
							{c?.title ?? "Empty"}
						</span>
					</li>
				);
			})}
		</ol>
	);
}

function PickRow({
	candidate: c,
	index,
	place,
	full,
	goal,
	onToggle,
}: {
	candidate: Candidate;
	index: number;
	place: number;
	full: boolean;
	goal: string | null;
	onToggle: () => void;
}) {
	const on = place >= 0;
	const app = seal(c.app);
	return (
		<li>
			<button
				type="button"
				onClick={onToggle}
				aria-pressed={on}
				disabled={!on && full}
				aria-keyshortcuts={index < 9 ? String(index + 1) : undefined}
				className="flex min-h-14 w-full items-center gap-3 py-2 text-left transition-opacity disabled:opacity-45"
			>
				<span
					aria-hidden
					className={cn(
						"flex size-7 shrink-0 items-center justify-center rounded-button border text-xs font-semibold",
						on ? "border-transparent bg-primary text-primary-foreground" : "border-border",
					)}
				>
					{on ? place + 1 : null}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-medium">{c.title}</span>
					<span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
						<span aria-hidden className={cn(app.theme, "text-primary")}>
							{app.kanji}
						</span>
						{goal && <span className="text-primary">志 {goal} ·</span>}
						{c.carried ? "From yesterday" : c.week ? "Week focus" : c.note}
					</span>
				</span>
				{on && <HugeiconsIcon icon={Tick02Icon} aria-hidden className="size-4 text-primary" />}
			</button>
		</li>
	);
}
