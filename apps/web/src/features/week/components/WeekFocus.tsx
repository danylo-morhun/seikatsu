"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { PickRow } from "@/features/day/lib/data";
import { QUEUED_TOAST, runOrQueue } from "@/features/pwa/lib/run";
import { finishCard } from "@/features/seiryu/lib/finish";
import { tickFocus } from "@/features/week/actions/plan";

/**
 * The week's focus, ticked here: a card is finished in Seiryu (with Undo); anything else is
 * marked done on the week's plan.
 */
export function WeekFocus({
	weekStart,
	focus,
	title,
	canChange,
}: {
	weekStart: string;
	focus: PickRow[];
	title: string;
	canChange: boolean;
}) {
	const [done, setDone] = useState<Record<string, boolean>>({});
	const isDone = (p: PickRow) => done[p.key] ?? p.done;
	const set = (key: string, value: boolean | undefined) =>
		setDone((prev) => {
			const next = { ...prev };
			if (value === undefined) delete next[key];
			else next[key] = value;
			return next;
		});

	async function toggle(p: PickRow) {
		const on = !isDone(p);
		set(p.key, on);
		if (on && p.card?.doneColumnId) {
			const { card } = p;
			await finishCard({ id: card.id, title: card.title }, card.doneColumnId as string, card, {
				onFail: () => set(p.key, undefined),
				onUndo: () => set(p.key, false),
			});
			return;
		}
		const args = { weekStart, key: p.key, done: on };
		const result = await runOrQueue(
			"week.tick",
			args,
			`${on ? "Done" : "Not done"}: ${p.title}`,
			() => tickFocus(args),
		).catch(() => ({ error: "Couldn't save. Check your connection." }));
		if ("error" in result) {
			set(p.key, undefined);
			toast.error(result.error);
		} else if ("queued" in result) toast(QUEUED_TOAST);
	}

	const count = focus.filter(isDone).length;
	return (
		<section aria-label={title} className="space-y-2">
			<div className="flex items-baseline justify-between px-1">
				<h2 className="text-sm font-medium text-muted-foreground">
					{title}{" "}
					<span className="font-figures tabular-nums text-foreground">
						{count}/{focus.length}
					</span>
				</h2>
				{canChange && (
					<Link
						href="/week/plan"
						prefetch
						className="text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						Change
					</Link>
				)}
			</div>
			<ul aria-label="Week focus" className="inset-group">
				{focus.map((p) => {
					const on = isDone(p);
					const locked =
						on && done[p.key] === undefined && !p.live && !p.card && !p.key.startsWith("own:");
					return (
						<li key={p.key} className="flex min-h-14 items-center gap-3 py-2">
							<button
								type="button"
								onClick={() => toggle(p)}
								disabled={locked}
								aria-pressed={on}
								aria-label={`${on ? "Not done" : "Done"}: ${p.title}`}
								className={cn(
									"flex size-7 shrink-0 items-center justify-center rounded-button border transition-colors",
									on
										? "border-transparent bg-primary text-primary-foreground"
										: "border-border hover:border-foreground/40",
								)}
							>
								{on && <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />}
							</button>
							<Link href={p.href} prefetch className="group min-w-0 flex-1 outline-none">
								<span
									className={cn(
										"block truncate text-sm font-medium group-hover:underline",
										on && "text-muted-foreground line-through",
									)}
								>
									{p.title}
								</span>
								{p.live?.note && !on && (
									<span className="block truncate text-xs text-muted-foreground">
										{p.live.note}
									</span>
								)}
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
