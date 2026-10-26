"use client";

import { ContextArea, openContextMenu } from "@/components/ContextArea";
import { QuietAdd } from "@/components/QuietAdd";
import type { ChromeData, HoshiiItem, HoshiiList } from "@/features/hoshii/actions/data";
import { stageOf, stageText, useItemLayer } from "@/features/hoshii/components/ItemLayer";
import { RowMenu } from "@/features/hoshii/components/NowView";
import { Thumb } from "@/features/hoshii/components/Thumb";
import { requestAdd } from "@/features/hoshii/lib/events";
import { formatMoney } from "@/features/hoshii/lib/format";
import { moveRowFocus, targetRow } from "@/features/hoshii/lib/keys";
import { pageKey } from "@/lib/capture-shortcut";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

function href(list: string | null, past: boolean) {
	const params = new URLSearchParams();
	if (list) params.set("list", list);
	if (past) params.set("past", "1");
	const qs = params.toString();
	return qs ? `/hoshii/lists?${qs}` : "/hoshii/lists";
}

/** Every want as a photo grid, a list at a time; bought and let go on request. */
export function ListsView({
	items,
	shown,
	lists,
	listId,
	past,
	ranks,
	chrome,
	today,
}: {
	/** All wants (for the sheet and the counts). */
	items: HoshiiItem[];
	/** The ones on screen, in order. */
	shown: HoshiiItem[];
	lists: HoshiiList[];
	listId: string | null;
	past: boolean;
	/** Plan rank by want id. */
	ranks: Record<string, number>;
	chrome: ChromeData;
	today: string;
}) {
	const { layer, actions } = useItemLayer({ items, chrome, today });
	const [menuId, setMenuId] = useState<string | null>(null);
	const menuItem = menuId ? items.find((i) => i.id === menuId) : undefined;
	const live = (i: HoshiiItem) => i.state === "cooling" || i.state === "plan";
	const count = (id: string | null) =>
		items.filter((i) => (past || live(i)) && (id == null || i.listId === id)).length;

	const keyRef = useRef<(key: string, e: KeyboardEvent) => boolean>(() => false);
	keyRef.current = (key, e) => {
		const el = targetRow();
		const item = el?.dataset.hoshiiId ? items.find((i) => i.id === el.dataset.hoshiiId) : undefined;
		if (!el || !item) return false;
		if (key === "k") actions.keep(item);
		else if (key === "l") actions.release(item);
		else if (key === "b") actions.buy(item, !e.repeat);
		else if (key === "e") actions.edit(item, !e.repeat);
		else if (key === "delete") actions.remove(item);
		else if (key === ".") openContextMenu(el);
		else return false;
		return true;
	};
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if ((k && keyRef.current(k, e)) || moveRowFocus(e)) e.preventDefault();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const chip = (id: string | null, name: string) => {
		const on = listId === id;
		return (
			<Link
				key={id ?? "all"}
				href={href(id, past)}
				prefetch
				aria-current={on ? "page" : undefined}
				className={cn(
					"inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
					on
						? "bg-foreground text-background"
						: "text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)] hover:bg-surface hover:text-foreground",
				)}
			>
				{name}
				<span className="font-figures text-xs opacity-60">{count(id)}</span>
			</Link>
		);
	};

	return (
		<>
			<h1 className="sr-only">Hoshii — every want</h1>
			<div className="flex animate-rise flex-wrap items-center gap-1.5">
				{chip(null, "All")}
				{lists.map((l) => chip(l.id, l.name))}
				<Link
					href={href(listId, !past)}
					prefetch
					role="switch"
					aria-checked={past}
					className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-sm:w-full"
				>
					<span
						aria-hidden
						className={cn(
							"relative h-[18px] w-8 rounded-full transition-colors duration-150",
							past ? "bg-primary" : "bg-surface-2 shadow-[inset_0_0_0_1px_var(--input)]",
						)}
					>
						<span
							className={cn(
								"absolute top-[3px] left-[3px] size-3 rounded-full transition-[transform,background-color] duration-200 ease-out",
								past ? "translate-x-3.5 bg-primary-foreground" : "bg-muted-foreground",
							)}
						/>
					</span>
					Bought and let go
				</Link>
			</div>

			<ContextArea
				attr="data-hoshii-id"
				onTarget={(id) => {
					setMenuId(id);
					return true;
				}}
				onClose={() => setMenuId(null)}
				menu={menuItem && <RowMenu item={menuItem} today={today} actions={actions} />}
			>
				{shown.length > 0 ? (
					<ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] sm:gap-x-5 sm:gap-y-8">
						{shown.map((item, i) => {
							const stage = stageOf(item, today);
							const done = stage === "bought" || stage === "released";
							return (
								<li
									key={item.id}
									data-hoshii-row
									className="animate-rise"
									style={rise(Math.min(i, 12) + 1)}
								>
									<button
										type="button"
										data-hoshii-id={item.id}
										onClick={() => actions.open(item)}
										className="group flex w-full min-w-0 flex-col gap-2 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
									>
										<span className="relative block">
											<Thumb
												src={item.imageUrl}
												className={cn(
													"aspect-[4/3] w-full max-w-full rounded-xl transition-[filter] duration-200",
													done && "opacity-55 grayscale-[35%]",
												)}
												iconClassName="max-h-10 max-w-10"
											/>
											{stage === "decide" && (
												<span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
													Decide
												</span>
											)}
										</span>
										<span className="line-clamp-2 text-sm leading-snug">{item.title}</span>
										<span className="flex items-baseline justify-between gap-2 text-xs">
											<span className="font-figures text-[13px] font-medium">
												{item.price != null ? formatMoney(Number(item.price), item.currency) : "—"}
											</span>
											<span
												className={cn(
													"truncate",
													stage === "decide" ? "font-medium text-primary" : "text-muted-foreground",
												)}
											>
												{stageText(item, today, ranks[item.id])}
											</span>
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				) : (
					<p className="mt-8 text-sm text-muted-foreground">
						{listId ? "Nothing in this list yet." : "No wants yet."}
					</p>
				)}
			</ContextArea>

			<div className="mt-8">
				<QuietAdd onClick={() => requestAdd()}>Add a want</QuietAdd>
			</div>
			{layer}
		</>
	);
}
