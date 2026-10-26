"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import type { ChromeData, HoshiiItem } from "@/features/hoshii/actions/data";
import { deleteItem } from "@/features/hoshii/actions/items";
import { BuyDialog } from "@/features/hoshii/components/BuyDialog";
import { ItemDialog } from "@/features/hoshii/components/ItemDialog";
import { Thumb } from "@/features/hoshii/components/Thumb";
import { daysBetween, formatDay } from "@/features/hoshii/lib/dates";
import { formatMoney, plural } from "@/features/hoshii/lib/format";
import type { MoveTarget } from "@/features/hoshii/lib/hoshii-schemas";
import { QUEUED_TOAST, sendMove } from "@/features/hoshii/lib/offline";
import { shopOf } from "@/features/hoshii/lib/product";
import {
	Cancel01Icon,
	Delete01Icon,
	FlashIcon,
	LinkSquare02Icon,
	PencilEdit01Icon,
	ShoppingCart01Icon,
	Tick02Icon,
	Undo02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	cn,
	useIsMobile,
} from "@seikatsu/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type Stage = "decide" | "cooling" | "plan" | "bought" | "released";

export function stageOf(item: Pick<HoshiiItem, "state" | "coolUntil">, today: string): Stage {
	if (item.state === "cooling") return item.coolUntil <= today ? "decide" : "cooling";
	return item.state;
}

/** A short line on where the want stands: "Cooling · 12 days", "Plan · #2". */
export function stageText(item: HoshiiItem, today: string, rank?: number): string {
	switch (stageOf(item, today)) {
		case "decide":
			return "Decide now";
		case "cooling":
			return `Cooling · ${plural(daysBetween(today, item.coolUntil), "day")}`;
		case "plan":
			return rank ? `Plan · #${rank}` : "Plan";
		case "bought":
			return `Bought ${formatDay(item.boughtOn ?? today, today)}`;
		default:
			return `Let go ${formatDay(item.releasedOn ?? today, today)}`;
	}
}

const FAILED = { error: "Couldn't save. Check your connection." };

/**
 * Everything a want can open: its sheet, the edit and purchase dialogs, the delete check,
 * and the moves (keep, let go, need it now) with an Undo. Shared by Now and Lists.
 */
export function useItemLayer({
	items,
	chrome,
	today,
	hideOnMove = false,
}: {
	items: HoshiiItem[];
	chrome: ChromeData;
	today: string;
	/** Now: a moved want leaves its group at once, before the page catches up. */
	hideOnMove?: boolean;
}) {
	const [sheetId, setSheetId] = useState<string | null>(null);
	const [edit, setEdit] = useState<{ item: HoshiiItem; instant: boolean } | null>(null);
	const [buy, setBuy] = useState<{ item: HoshiiItem; instant: boolean } | null>(null);
	const [deleting, setDeleting] = useState<HoshiiItem | null>(null);
	const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

	// Fresh wants from the server: whatever was hidden has moved for real.
	useEffect(() => setHidden(new Set()), [items]);

	const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
	const sheetItem = sheetId ? byId.get(sheetId) : undefined;

	const move = useCallback(
		async (item: HoshiiItem, to: MoveTarget, done: string, undoTo: MoveTarget) => {
			if (hideOnMove) setHidden((h) => new Set(h).add(item.id));
			const result = await sendMove(item, to).catch(() => FAILED);
			if ("error" in result) {
				setHidden((h) => {
					const next = new Set(h);
					next.delete(item.id);
					return next;
				});
				toast.error(result.error);
				return;
			}
			if ("queued" in result) {
				toast(QUEUED_TOAST);
				return;
			}
			toast(done, {
				action: {
					label: "Undo",
					onClick: () =>
						void sendMove(item, undoTo).then((r) => "error" in r && toast.error(r.error)),
				},
			});
		},
		[hideOnMove],
	);

	const actions = useMemo(
		() => ({
			open: (item: HoshiiItem) => setSheetId(item.id),
			edit: (item: HoshiiItem, instant = false) => setEdit({ item, instant }),
			buy: (item: HoshiiItem, instant = false) => {
				if (item.state === "released") return;
				setBuy({ item, instant });
			},
			remove: (item: HoshiiItem) => setDeleting(item),
			keep: (item: HoshiiItem) => {
				if (stageOf(item, today) !== "decide") return;
				void move(item, "plan", `Kept · ${item.title} joins the Plan`, "cooling");
			},
			needNow: (item: HoshiiItem) => {
				if (stageOf(item, today) !== "cooling") return;
				void move(item, "plan", `${item.title} skipped cooling`, "cooling");
			},
			release: (item: HoshiiItem) => {
				if (item.state !== "cooling" && item.state !== "plan") return;
				const saved =
					item.base != null ? ` · ${formatMoney(item.base, chrome.currency, true)} not spent` : "";
				void move(item, "released", `Let go${saved}`, item.state);
			},
			/** A want let go, wanted again: back where it was decided from. */
			restore: (item: HoshiiItem) =>
				void move(item, item.keptOn ? "plan" : "cooling", `${item.title} is back`, "released"),
			unbuy: (item: HoshiiItem) =>
				void move(
					item,
					"plan",
					item.kurojiTransactionId
						? "Back in the Plan. Its expense stays in Kuroji"
						: "Back in the Plan",
					"plan",
				),
		}),
		[move, today, chrome.currency],
	);

	const layer = (
		<>
			<ItemSheet
				item={sheetItem ?? null}
				onOpenChange={(open) => !open && setSheetId(null)}
				today={today}
				currency={chrome.currency}
				actions={actions}
			/>
			<ItemDialog
				open={edit != null}
				instant={edit?.instant}
				onOpenChange={(open) => !open && setEdit(null)}
				chrome={chrome}
				item={edit?.item ?? null}
			/>
			<BuyDialog
				open={buy != null}
				instant={buy?.instant}
				onOpenChange={(open) => !open && setBuy(null)}
				chrome={chrome}
				item={buy?.item ?? null}
			/>
			<ConfirmDelete
				open={deleting != null}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete “${deleting?.title ?? ""}”?`}
				description={
					deleting?.kurojiTransactionId
						? "It goes from Hoshii for good. Its expense stays in Kuroji."
						: "It goes from Hoshii for good, with its history."
				}
				onConfirm={async () => {
					if (!deleting) return;
					setSheetId(null);
					const result = await deleteItem(deleting.id).catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
				}}
			/>
		</>
	);

	return { layer, actions, hidden };
}

export type ItemActions = ReturnType<typeof useItemLayer>["actions"];

/** A want in full: photo, price, where it stands and how it got there, and what's next. */
function ItemSheet({
	item,
	onOpenChange,
	today,
	currency,
	actions,
}: {
	item: HoshiiItem | null;
	onOpenChange: (open: boolean) => void;
	today: string;
	currency: string;
	actions: ItemActions;
}) {
	const isMobile = useIsMobile();
	// The last want shown stays put while the sheet slides away.
	const [shown, setShown] = useState(item);
	useEffect(() => {
		if (item) setShown(item);
	}, [item]);
	const it = item ?? shown;
	const stage = it ? stageOf(it, today) : null;
	const run = (fn: (i: HoshiiItem) => void) => () => {
		if (!it) return;
		onOpenChange(false);
		fn(it);
	};

	return (
		<Sheet open={item != null} onOpenChange={onOpenChange}>
			<SheetContent
				side={isMobile ? "bottom" : "right"}
				className={cn(
					"gap-0 overflow-y-auto [scrollbar-width:thin]",
					isMobile
						? "max-h-[92dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
						: "w-full data-[side=right]:w-full data-[side=right]:sm:max-w-md",
				)}
			>
				{it && stage && (
					<>
						<div className="px-4 pt-4 sm:px-6 sm:pt-6">
							<Thumb
								src={it.imageUrl}
								priority
								className="aspect-[4/3] w-full max-w-full rounded-xl"
								iconClassName="max-h-12 max-w-12"
							/>
						</div>
						<SheetHeader className="px-4 pt-5 pb-0 sm:px-6">
							<SheetTitle className="text-lg leading-snug font-semibold tracking-tight text-balance">
								{it.title}
							</SheetTitle>
							<SheetDescription className="font-figures text-2xl font-semibold tracking-tight text-foreground">
								{it.price != null ? formatMoney(Number(it.price), it.currency) : "No price yet"}
								{it.price != null && it.currency !== currency && it.base != null && (
									<span className="ml-2 text-sm font-medium text-muted-foreground">
										≈ {formatMoney(it.base, currency, true)}
									</span>
								)}
							</SheetDescription>
						</SheetHeader>

						<div className="space-y-5 px-4 py-5 sm:px-6">
							<dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
								<dt className="text-muted-foreground">Where</dt>
								<dd className={cn(stage === "decide" && "font-medium text-primary")}>
									{stageText(it, today)}
								</dd>
								{it.listName && (
									<>
										<dt className="text-muted-foreground">List</dt>
										<dd>{it.listName}</dd>
									</>
								)}
								{it.url && (
									<>
										<dt className="text-muted-foreground">Shop</dt>
										<dd className="min-w-0">
											<a
												href={it.url}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex max-w-full items-center gap-1 rounded underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
											>
												<span className="truncate">{shopOf(it.url) ?? it.url}</span>
												<HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5 shrink-0" />
											</a>
										</dd>
									</>
								)}
								{it.state === "bought" && it.boughtPrice != null && (
									<>
										<dt className="text-muted-foreground">Paid</dt>
										<dd className="font-figures">
											{formatMoney(Number(it.boughtPrice), it.boughtCurrency ?? it.currency)}
											{it.kurojiTransactionId && (
												<span className="text-muted-foreground"> · in Kuroji</span>
											)}
										</dd>
									</>
								)}
							</dl>

							<div className="rounded-lg bg-surface px-3.5 py-3 text-sm">
								<p className="mb-1 text-xs text-muted-foreground">Why you want it</p>
								{it.note ? (
									<p className="leading-relaxed">{it.note}</p>
								) : (
									<button
										type="button"
										onClick={run((i) => actions.edit(i))}
										className="rounded text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
									>
										Add a line: it helps when it's time to decide
									</button>
								)}
							</div>

							<section aria-label="History">
								<p className="mb-2.5 text-xs text-muted-foreground">History</p>
								<ol className="space-y-2 text-sm">
									{history(it, today).map((h) => (
										<li
											key={h.label}
											className="grid grid-cols-[0.875rem_minmax(0,1fr)_auto] items-center gap-2.5"
										>
											<span
												aria-hidden
												className={cn(
													"size-[7px] justify-self-center rounded-full",
													h.done ? "bg-primary" : "bg-input",
												)}
											/>
											<span className={cn(!h.done && "text-muted-foreground")}>{h.label}</span>
											<span className="font-figures text-xs text-muted-foreground">
												{formatDay(h.date, today)}
											</span>
										</li>
									))}
								</ol>
							</section>
						</div>

						<div className="mt-auto flex flex-wrap gap-2 border-t border-rule px-4 py-4 sm:px-6">
							{stage === "decide" && (
								<>
									<Button className="gap-1.5" onClick={run(actions.keep)} aria-keyshortcuts="K">
										<HugeiconsIcon icon={Tick02Icon} />
										Keep
									</Button>
									<Button
										variant="outline"
										className="gap-1.5"
										onClick={run(actions.release)}
										aria-keyshortcuts="L"
									>
										<HugeiconsIcon icon={Cancel01Icon} />
										Let go
									</Button>
								</>
							)}
							{stage === "cooling" && (
								<>
									<Button variant="outline" className="gap-1.5" onClick={run(actions.needNow)}>
										<HugeiconsIcon icon={FlashIcon} />
										Need it now
									</Button>
									<Button variant="ghost" onClick={run(actions.release)} aria-keyshortcuts="L">
										Let go
									</Button>
								</>
							)}
							{stage === "plan" && (
								<>
									<Button
										className="gap-1.5"
										onClick={run((i) => actions.buy(i))}
										aria-keyshortcuts="B"
									>
										<HugeiconsIcon icon={ShoppingCart01Icon} />
										Bought it…
									</Button>
									<Button variant="outline" onClick={run(actions.release)} aria-keyshortcuts="L">
										Let go
									</Button>
								</>
							)}
							{stage === "bought" && (
								<>
									<Button variant="outline" onClick={run((i) => actions.buy(i))}>
										Edit purchase…
									</Button>
									<Button variant="ghost" className="gap-1.5" onClick={run(actions.unbuy)}>
										<HugeiconsIcon icon={Undo02Icon} />
										Not bought
									</Button>
								</>
							)}
							{stage === "released" && (
								<Button variant="outline" className="gap-1.5" onClick={run(actions.restore)}>
									<HugeiconsIcon icon={Undo02Icon} />
									Want it again
								</Button>
							)}
							<span className="ml-auto flex gap-1">
								<Button
									variant="ghost"
									size="icon"
									aria-label="Edit"
									aria-keyshortcuts="E"
									onClick={run((i) => actions.edit(i))}
								>
									<HugeiconsIcon icon={PencilEdit01Icon} />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									aria-label="Delete"
									className="text-muted-foreground hover:text-destructive"
									onClick={run(actions.remove)}
								>
									<HugeiconsIcon icon={Delete01Icon} />
								</Button>
							</span>
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}

/** How the want got here, and what's still ahead. */
function history(it: HoshiiItem, today: string) {
	const steps: { label: string; date: string; done: boolean }[] = [
		{ label: "Added", date: it.addedOn, done: true },
	];
	if (it.skippedCooling && it.keptOn) {
		steps.push({ label: "Skipped cooling", date: it.keptOn, done: true });
	} else if (it.state === "cooling" || it.keptOn || it.releasedOn) {
		const over = it.coolUntil <= today;
		steps.push({ label: over ? "Cooled" : "Cooling ends", date: it.coolUntil, done: over });
		if (it.keptOn) steps.push({ label: "Kept", date: it.keptOn, done: true });
	}
	if (it.boughtOn) steps.push({ label: "Bought", date: it.boughtOn, done: true });
	if (it.releasedOn) steps.push({ label: "Let go", date: it.releasedOn, done: true });
	return steps;
}
