"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn, Input } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { Spinner } from "@/components/Spinner";
import { Steps, StepTitle } from "@/features/day/components/Steps";
import type { DayPick } from "@/features/day/lib/day";
import { sealOf } from "@/features/home/lib/seal";
import { QUEUED_TOAST, runOrQueue } from "@/features/pwa/lib/run";
import { saveWeek } from "@/features/week/actions/plan";
import { type FocusCandidate, MAX_FOCUS } from "@/features/week/lib/rhythm";
import { pageKey } from "@/lib/capture-shortcut";

type Look = {
	title: string;
	line: string | null;
	planned: number;
	closed: number;
	done: number;
	of: number;
	habits: number | null;
	cardsDone: number;
};

const FROM: Record<FocusCandidate["from"], string> = {
	carried: "From last week",
	goal: "Goal's next step",
	doing: "In progress",
	soon: "Due soon",
};

const seal = (app: string) => sealOf(app, "週");

/**
 * The week's plan: a look back at the week before (how the days went, which goals need a
 * hand), then up to three things in focus — leftovers, goals' next steps, cards under way, or
 * the user's own words. The morning offers them first all week.
 */
export function WeekPlanFlow({
	target,
	next,
	look,
	needs,
	candidates: offered,
	picked,
}: {
	/** The Monday of the week being planned. */
	target: string;
	/** It's next week (planned on Sunday evening). */
	next: boolean;
	look: Look;
	needs: { name: string; why: string }[];
	candidates: FocusCandidate[];
	picked: DayPick[] | null;
}) {
	const router = useRouter();
	const ownId = useId();
	const [step, setStep] = useState(picked ? 1 : 0);
	const [own, setOwn] = useState<FocusCandidate[]>(() =>
		(picked ?? [])
			.filter((p) => p.key.startsWith("own:"))
			.map((p) => ({ ...p, note: "Your words", from: "doing", goal: null })),
	);
	const candidates = [...own, ...offered];
	const [chosen, setChosen] = useState<string[]>(() =>
		(
			picked?.map((p) => p.key) ?? offered.filter((c) => c.from === "carried").map((c) => c.key)
		).slice(0, MAX_FOCUS),
	);
	const [text, setText] = useState("");
	const [saving, startSaving] = useTransition();

	function toggle(key: string) {
		setChosen((prev) =>
			prev.includes(key)
				? prev.filter((k) => k !== key)
				: prev.length < MAX_FOCUS
					? [...prev, key]
					: prev,
		);
	}

	function addOwn() {
		const title = text.trim();
		if (!title) return;
		const item: FocusCandidate = {
			key: `own:${crypto.randomUUID()}`,
			title,
			href: "/week",
			app: "/week",
			note: "Your words",
			from: "doing",
			goal: null,
		};
		setOwn((prev) => [item, ...prev]);
		setChosen((prev) => (prev.length < MAX_FOCUS ? [...prev, item.key] : prev));
		setText("");
	}

	function save() {
		const byKey = new Map(candidates.map((c) => [c.key, c]));
		const focus = chosen.flatMap((k) => {
			const c = byKey.get(k);
			return c ? [{ key: c.key, title: c.title, href: c.href, app: c.app }] : [];
		});
		startSaving(async () => {
			const args = { weekStart: target, focus };
			const result = await runOrQueue("week.save", args, "Plan the week", () =>
				saveWeek(args),
			).catch(() => ({ error: "Couldn't save. Check your connection." }));
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			if ("queued" in result) toast(QUEUED_TOAST);
			startNavigationProgress();
			router.push(next ? `/week?w=${target}` : "/week");
		});
	}

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "]" && step === 0) {
				e.preventDefault();
				setStep(1);
			} else if (k === "[" && step === 1) {
				e.preventDefault();
				setStep(0);
			} else if (step === 1 && k && /^[1-9]$/.test(k)) {
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
			<Steps step={step} of={2} />
			{step === 0 ? (
				<>
					<StepTitle title={look.title} subtitle={look.line ?? "Nothing logged."} />
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
						<Figure value={`${look.planned}/7`} label="days planned" />
						<Figure value={`${look.closed}/7`} label="days closed" />
						<Figure value={look.of > 0 ? `${look.done}/${look.of}` : "—"} label="picks done" />
						<Figure value={look.habits != null ? `${look.habits}%` : "—"} label="habits kept" />
					</div>
					{needs.length > 0 && (
						<section aria-label="Goals that need a hand" className="mt-6">
							<h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
								Goals that need a hand
							</h2>
							<ul className="inset-group">
								{needs.map((g) => (
									<li key={g.name} className="flex min-h-12 items-center gap-3 py-2">
										<span aria-hidden className="text-primary">
											志
										</span>
										<span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
										<span className="shrink-0 text-xs text-negative">{g.why}</span>
									</li>
								))}
							</ul>
						</section>
					)}
					<div className="mt-6 flex justify-end">
						<Button onClick={() => setStep(1)} aria-keyshortcuts="]">
							Next · {next ? "next week's" : "this week's"} focus
						</Button>
					</div>
				</>
			) : (
				<>
					<StepTitle
						title={next ? "Next week's focus" : "This week's focus"}
						subtitle="Up to three. Each morning offers them first."
					/>
					<form
						className="mb-4 flex gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							addOwn();
						}}
					>
						<label htmlFor={ownId} className="sr-only">
							Your own focus
						</label>
						<Input
							id={ownId}
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder="In your own words…"
							autoComplete="off"
						/>
						<Button type="submit" variant="outline" disabled={!text.trim()}>
							Add
						</Button>
					</form>
					{candidates.length === 0 ? (
						<p className="rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-4 text-sm text-muted-foreground">
							Nothing under way. Write what the week is for above.
						</p>
					) : (
						<ul aria-label="Pick up to three" className="inset-group">
							{candidates.map((c, i) => {
								const place = chosen.indexOf(c.key);
								const on = place >= 0;
								const app = seal(c.app);
								return (
									<li key={c.key}>
										<button
											type="button"
											onClick={() => toggle(c.key)}
											aria-pressed={on}
											disabled={!on && chosen.length >= MAX_FOCUS}
											aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
											className="flex min-h-14 w-full items-center gap-3 py-2 text-left transition-opacity disabled:opacity-45"
										>
											<span
												aria-hidden
												className={cn(
													"flex size-7 shrink-0 items-center justify-center rounded-button border text-xs font-semibold",
													on
														? "border-transparent bg-primary text-primary-foreground"
														: "border-border",
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
													{c.goal ? <span className="text-primary">志 {c.goal}</span> : null}
													{c.goal ? " · " : ""}
													{c.from === "doing" && c.key.startsWith("own:") ? c.note : FROM[c.from]}
												</span>
											</span>
											{on && (
												<HugeiconsIcon
													icon={Tick02Icon}
													aria-hidden
													className="size-4 text-primary"
												/>
											)}
										</button>
									</li>
								);
							})}
						</ul>
					)}
					<div className="mt-6 flex items-center justify-between gap-3">
						<Button variant="ghost" onClick={() => setStep(0)} aria-keyshortcuts="[">
							Back
						</Button>
						<Button onClick={save} disabled={saving} className="gap-1.5">
							{saving && <Spinner />}
							{saving ? "Saving…" : next ? "Plan next week" : "Plan the week"}
						</Button>
					</div>
				</>
			)}
		</div>
	);
}

function Figure({ value, label }: { value: string; label: string }) {
	return (
		<div className="rounded-group bg-[var(--group-bg)] px-3 py-2.5">
			<p className="font-figures text-lg font-semibold tabular-nums">{value}</p>
			<p className="text-xs text-muted-foreground">{label}</p>
		</div>
	);
}
