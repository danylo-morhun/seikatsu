"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { PickRow } from "@/features/day/lib/data";
import { tick } from "@/features/day/lib/offline";
import { sealOf } from "@/features/home/lib/seal";
import { QUEUED_TOAST } from "@/features/pwa/lib/run";
import { finishCard } from "@/features/seiryu/lib/finish";

const seal = (app: string) => sealOf(app);

/**
 * The day's picks, ticked right here: a card is finished in Seiryu (its own act, with Undo);
 * anything else is marked done on the plan.
 */
export function MyDay({ day, picks }: { day: string; picks: PickRow[] }) {
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
		const result = await tick(day, p, on).catch(() => ({
			error: "Couldn't save. Check your connection.",
		}));
		if ("error" in result) {
			set(p.key, undefined);
			toast.error(result.error);
		} else if ("queued" in result) toast(QUEUED_TOAST);
	}

	const count = picks.filter(isDone).length;

	return (
		<div className="space-y-3">
			<div className="flex items-baseline justify-between px-1">
				<h2 className="text-sm font-medium text-muted-foreground">
					My day{" "}
					<span className="font-figures tabular-nums text-foreground">
						{count}/{picks.length}
					</span>
				</h2>
				<Link
					href="/morning?step=pick"
					prefetch
					className="text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					Change
				</Link>
			</div>
			{picks.length === 0 ? (
				<p className="rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-4 text-sm text-muted-foreground">
					Nothing picked. The list below is the day.
				</p>
			) : (
				<ul aria-label="My day" className="inset-group">
					{picks.map((p) => {
						const on = isDone(p);
						// Done by its app (payments in, card finished elsewhere): not undone from here.
						const locked = on && done[p.key] === undefined && !p.live && !p.card;
						const app = seal(p.app);
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
											"block truncate text-sm font-medium group-hover:underline group-focus-visible:underline",
											on && "text-muted-foreground line-through",
										)}
									>
										{p.title}
									</span>
									<span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
										<span aria-hidden className={cn(app.theme, "text-primary")}>
											{app.kanji}
										</span>
										{on ? "Done" : (p.live?.note ?? "")}
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
