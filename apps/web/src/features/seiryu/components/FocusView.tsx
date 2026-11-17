"use client";

import { CheckListIcon, HourglassIcon, RepeatIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { openCapture } from "@/features/capture/lib/key";
import { DueDateChip } from "@/features/seiryu/components/DueDateChip";
import { PriorityBadge } from "@/features/seiryu/components/PriorityBadge";
import { addDays } from "@/features/seiryu/lib/filters";
import { finishCard } from "@/features/seiryu/lib/finish";
import type { FocusCard, FocusSection } from "@/features/seiryu/lib/focus";
import { buildFocus } from "@/features/seiryu/lib/focus";
import { saveCard } from "@/features/seiryu/lib/offline";
import { stuckDays } from "@/features/seiryu/lib/types";
import { pageKey } from "@/lib/capture-shortcut";

interface Props {
	sections: FocusSection[];
	today: string;
	/** Projects exist: an empty Focus says the work is planned out, not that there is none. */
	projectCount: number;
}

/**
 * Seiryu's start page: what to work on across every project, by when — late, today, started,
 * the week ahead. Done, Today and +1 day act in place; a row opens its card.
 */
export function FocusView({ sections: serverSections, today, projectCount }: Props) {
	const router = useRouter();
	// Rows change at once; fresh props from each action's re-render take over.
	const [cards, setCards] = useState(() => serverSections.flatMap((s) => s.cards));
	useEffect(() => setCards(serverSections.flatMap((s) => s.cards)), [serverSections]);
	const sections = useMemo(() => buildFocus(cards, today), [cards, today]);
	const cardsRef = useRef(cards);
	cardsRef.current = cards;

	function finish(card: FocusCard) {
		if (!card.doneColumnId) {
			toast.error(`${card.projectName} has no finish column`);
			return;
		}
		const before = cardsRef.current;
		setCards((prev) => prev.filter((c) => c.id !== card.id));
		void finishCard(
			card,
			card.doneColumnId,
			{ columnId: card.columnId, position: card.position },
			{ onFail: () => setCards(before), onUndo: () => setCards(before) },
		);
	}

	function moveDue(card: FocusCard, dueDate: string) {
		const before = cardsRef.current;
		setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, dueDate } : c)));
		saveCard(card.id, card.title, { dueDate }).then((result) => {
			if ("error" in result) {
				toast.error(result.error);
				setCards(before);
			}
		});
	}

	// Overdue, all at once: to tomorrow, with one Undo that puts each date back.
	function moveAllToTomorrow(late: FocusCard[]) {
		const tomorrow = addDays(today, 1);
		const before = cardsRef.current;
		const ids = new Set(late.map((c) => c.id));
		setCards((prev) => prev.map((c) => (ids.has(c.id) ? { ...c, dueDate: tomorrow } : c)));
		Promise.all(late.map((c) => saveCard(c.id, c.title, { dueDate: tomorrow }))).then((results) => {
			const failed = results.find((r) => "error" in r);
			if (failed && "error" in failed) {
				toast.error(failed.error);
				setCards(before);
				return;
			}
			toast(`${late.length === 1 ? "1 card" : `${late.length} cards`} moved to tomorrow`, {
				action: {
					label: "Undo",
					onClick: () => {
						setCards(before);
						for (const c of late) void saveCard(c.id, c.title, { dueDate: c.dueDate });
					},
				},
			});
		});
	}

	function open(card: FocusCard) {
		startNavigationProgress();
		router.push(`/seiryu/${card.projectId}/${card.id}`);
	}

	// N captures; the row in focus (or under the pointer) takes X, T, D and E.
	const keyRef = useRef<(key: string) => boolean>(() => false);
	keyRef.current = (key) => {
		if (key === "n") {
			openCapture();
			return true;
		}
		if (key === ",") {
			startNavigationProgress();
			router.push("/settings/seiryu");
			return true;
		}
		const row = targetRow();
		const card = row ? cardsRef.current.find((c) => c.id === row.dataset.focusCard) : undefined;
		if (!row || !card) return false;
		const focused = document.activeElement === row;
		const after = focused ? (neighbourRow(row, 1) ?? neighbourRow(row, -1)) : null;
		if (key === "x") {
			finish(card);
			after?.focus();
		} else if (key === "t") moveDue(card, today);
		else if (key === "d") {
			const from = card.dueDate && card.dueDate > today ? card.dueDate : today;
			moveDue(card, addDays(from, 1));
		} else if (key === "e") open(card);
		else return false;
		return true;
	};
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k && keyRef.current(k)) e.preventDefault();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<div className="flex-1 overflow-y-auto px-4 pt-5 pb-28 [scrollbar-width:thin] sm:px-8 md:pb-12">
			<h1 className="title-large">Focus</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				Every project at once: what's late, due today, started and coming up this week.
			</p>

			{sections.length === 0 ? (
				<p className="mt-10 text-sm text-muted-foreground">
					{projectCount > 0
						? "Nothing late, due or in progress. Cards with a date in the next week show up here."
						: "No projects yet."}
				</p>
			) : (
				<div className="mt-6 flex max-w-3xl flex-col gap-8">
					{sections.map((section, s) => (
						<section
							key={section.key}
							aria-labelledby={`focus-${section.key}`}
							className="animate-rise"
							style={{ "--i": s } as React.CSSProperties}
						>
							<h2
								id={`focus-${section.key}`}
								className={cn(
									"flex items-baseline justify-between border-b border-(--head-rule) px-(--head-inset) pb-2 text-sm font-medium",
									section.key === "overdue" ? "text-negative" : "text-muted-foreground",
								)}
							>
								<span>
									{section.title}{" "}
									<span className="font-figures text-xs tabular-nums">{section.cards.length}</span>
								</span>
								{section.key === "overdue" && (
									<button
										type="button"
										onClick={() => moveAllToTomorrow(section.cards)}
										className="rounded-button px-1.5 text-xs font-normal text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
									>
										All to tomorrow
									</button>
								)}
							</h2>
							<ol className="inset-group">
								{section.cards.map((card) => (
									<FocusRow key={card.id} card={card} today={today} onFinish={() => finish(card)} />
								))}
							</ol>
						</section>
					))}
				</div>
			)}
		</div>
	);
}

function FocusRow({
	card,
	today,
	onFinish,
}: {
	card: FocusCard;
	today: string;
	onFinish: () => void;
}) {
	const stuck = card.started ? stuckDays(card.movedAt) : null;
	return (
		<li
			data-focus-card={card.id}
			// biome-ignore lint/a11y/noNoninteractiveTabindex: rows take the card keys (X, T, D, E)
			tabIndex={0}
			aria-label={card.title}
			onKeyDown={(e) => {
				if (e.key === "Enter" && e.target === e.currentTarget) {
					e.currentTarget.querySelector<HTMLAnchorElement>("a")?.click();
					return;
				}
				if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
				const next = neighbourRow(e.currentTarget, e.key === "ArrowDown" ? 1 : -1);
				if (!next) return;
				e.preventDefault();
				next.focus();
				next.scrollIntoView({ block: "nearest" });
			}}
			className="flex min-h-14 items-center gap-3 rounded-md py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<button
				type="button"
				onClick={onFinish}
				aria-label={`Done: ${card.title}`}
				aria-keyshortcuts="X"
				disabled={!card.doneColumnId}
				className="group flex size-7 shrink-0 items-center justify-center rounded-full border border-input text-transparent outline-none transition-colors duration-150 hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
			>
				<HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
			</button>
			<Link
				href={`/seiryu/${card.projectId}/${card.id}`}
				prefetch={false}
				tabIndex={-1}
				className="group min-w-0 flex-1 outline-none"
			>
				<span className="block truncate text-sm font-medium group-hover:underline">
					{card.title}
				</span>
				<span className="mt-0.5 flex min-w-0 items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
					<span className="inline-flex min-w-0 items-center gap-1.5">
						<span
							aria-hidden
							className="size-1.5 shrink-0 rounded-full"
							style={{ backgroundColor: card.projectColor ?? "var(--muted-foreground)" }}
						/>
						<span className="truncate">
							{card.projectName}
							{card.groupName && ` · ${card.groupName}`}
						</span>
					</span>
					{card.waitingOn && (
						<span className="truncate max-sm:hidden">waiting on {card.waitingOn}</span>
					)}
					{card.dueDate && (
						<DueDateChip
							dueDate={card.dueDate}
							dueTime={card.dueTime}
							today={today}
							className="shrink-0"
						/>
					)}
					{stuck && (
						<span
							title={`In this column for ${stuck} days`}
							className="inline-flex shrink-0 items-center gap-1 tabular-nums"
						>
							<HugeiconsIcon icon={HourglassIcon} className="h-3.5 w-3.5" />
							{stuck}d
						</span>
					)}
					{card.checklist && (
						<span className="inline-flex shrink-0 items-center gap-1 tabular-nums max-sm:hidden">
							<HugeiconsIcon icon={CheckListIcon} className="h-3.5 w-3.5" />
							{card.checklist.done}/{card.checklist.total}
						</span>
					)}
					{card.repeats && (
						<HugeiconsIcon
							icon={RepeatIcon}
							aria-label="Repeats"
							className="h-3.5 w-3.5 shrink-0 max-sm:hidden"
						/>
					)}
				</span>
			</Link>
			{card.priority && <PriorityBadge priority={card.priority} className="shrink-0" />}
		</li>
	);
}

function targetRow() {
	const focused = document.activeElement;
	if (focused instanceof HTMLElement && focused.matches("[data-focus-card]")) return focused;
	return document.querySelector<HTMLElement>("[data-focus-card]:hover");
}

function neighbourRow(row: HTMLElement, step: 1 | -1) {
	const rows = [...document.querySelectorAll<HTMLElement>("[data-focus-card]")];
	return rows[rows.indexOf(row) + step] ?? null;
}
