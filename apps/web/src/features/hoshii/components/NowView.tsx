"use client";

import { ContextArea, openContextMenu } from "@/components/ContextArea";
import { PageTitle } from "@/components/PageTitle";
import { QuietAdd } from "@/components/QuietAdd";
import { FIGURES_ROW, Figure } from "@/features/aisha/components/Figure";
import type { ChromeData, HoshiiData, HoshiiItem, PlanEntry } from "@/features/hoshii/actions/data";
import { type ItemActions, stageOf, useItemLayer } from "@/features/hoshii/components/ItemLayer";
import { Thumb } from "@/features/hoshii/components/Thumb";
import { daysBetween, formatDay } from "@/features/hoshii/lib/dates";
import { requestAdd } from "@/features/hoshii/lib/events";
import { formatMoney, plural } from "@/features/hoshii/lib/format";
import { moveRowFocus, targetRow } from "@/features/hoshii/lib/keys";
import { QUEUED_TOAST, sendReorder } from "@/features/hoshii/lib/offline";
import { linksText } from "@/features/hoshii/lib/product";
import { fundPlan } from "@/features/hoshii/lib/queue";
import { pageKey } from "@/lib/capture-shortcut";
import { generateKeyBetween } from "@/lib/position";
import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	type Modifier,
	MouseSensor,
	TouchSensor,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Cancel01Icon,
	Delete01Icon,
	FlashIcon,
	PencilEdit01Icon,
	ShoppingCart01Icon,
	Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	cn,
} from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;
const SORT_TRANSITION = { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });
const MONTH = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });

type Props = {
	data: Pick<HoshiiData, "queue" | "piggy" | "budget" | "currency" | "items">;
	chrome: ChromeData;
	today: string;
};

/** Now: the piggy and the month's budget, then what to decide, the Plan, and what's cooling. */
export function NowView({ data, chrome, today }: Props) {
	const { queue, piggy, budget, currency } = data;
	const { layer, actions, hidden } = useItemLayer({
		items: data.items,
		chrome,
		today,
		hideOnMove: true,
	});
	const [menuId, setMenuId] = useState<string | null>(null);
	const dndId = useId();

	// The Plan in the order on screen: a drag lands at once, the piggy re-flows with it.
	const [order, setOrder] = useState(() => queue.plan.map((p) => p.item.id));
	useEffect(() => setOrder(queue.plan.map((p) => p.item.id)), [queue.plan]);
	const plan = useMemo(() => {
		const byId = new Map(queue.plan.map((p) => [p.item.id, p.item]));
		const items = order
			.map((id) => byId.get(id))
			.filter((i): i is HoshiiItem => i != null && !hidden.has(i.id));
		return fundPlan(
			items.map((item) => ({ item, cost: item.base })),
			piggy?.balance ?? 0,
		);
	}, [order, queue.plan, hidden, piggy]);
	const decide = queue.decide.filter((i) => !hidden.has(i.id));
	const cooling = queue.cooling.filter((i) => !hidden.has(i.id));

	const all = [...decide, ...plan.map((p) => p.item), ...cooling];
	const find = (id: string) => all.find((i) => i.id === id);
	const menuItem = menuId ? find(menuId) : undefined;

	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	function onDragEnd({ active, over }: DragEndEvent) {
		if (!over || active.id === over.id) return;
		const ids = plan.map((p) => p.item.id);
		const from = ids.indexOf(String(active.id));
		const to = ids.indexOf(String(over.id));
		if (from < 0 || to < 0) return;
		const moved = arrayMove(plan, from, to);
		const item = moved[to].item;
		const position = generateKeyBetween(
			moved[to - 1]?.item.planPosition ?? null,
			moved[to + 1]?.item.planPosition ?? null,
		);
		const before = order;
		setOrder(moved.map((p) => p.item.id));
		sendReorder(item, position)
			.catch(() => ({ error: "Couldn't save. Check your connection." }))
			.then((result) => {
				if ("error" in result) {
					setOrder(before);
					toast.error(result.error);
				} else if ("queued" in result) toast(QUEUED_TOAST);
			});
	}

	// ── Keys: on the row in focus or under the pointer ──
	const keyRef = useRef<(key: string, e: KeyboardEvent) => boolean>(() => false);
	keyRef.current = (key, e) => {
		const el = targetRow();
		const item = el?.dataset.hoshiiId ? find(el.dataset.hoshiiId) : undefined;
		if (!el || !item) return false;
		const instant = !e.repeat;
		if (key === "k") actions.keep(item);
		else if (key === "l") actions.release(item);
		else if (key === "b") actions.buy(item, instant);
		else if (key === "e") actions.edit(item, instant);
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

	const total = plan.reduce((n, p) => n + (p.cost ?? 0), 0);
	const saved = plan.reduce((n, p) => n + p.funded, 0);
	const ready = plan.filter((p) => p.share != null && p.share >= 1).length;
	const head = plan.find((p) => p.share == null || p.share < 1);
	let index = 0;

	return (
		<>
			<PageTitle title="Now" subtitle="What to decide and what to buy" />
			<section
				aria-label="Wants at a glance"
				className={`${FIGURES_ROW} md:grid-cols-[1.4fr_1fr_1fr]`}
			>
				<div className="col-span-2 md:col-span-1">
					{piggy ? (
						<Figure
							lead
							index={index++}
							label={`Piggy · ${piggy.name}`}
							value={formatMoney(piggy.balance, currency, true)}
							note={
								plan.length === 0
									? "Keep a want and the piggy saves for it"
									: ready === plan.length
										? "Enough for the whole Plan"
										: ready > 0
											? `Enough for the first ${plural(ready, "want")} in the Plan`
											: head?.cost != null
												? `${formatMoney(head.cost - head.funded, currency, true)} short of the first in the Plan`
												: "Not enough for the first in the Plan yet"
							}
						/>
					) : (
						<Figure
							lead
							index={index++}
							label="Plan"
							value={formatMoney(total, currency, true)}
							note={
								<span className="flex min-w-0 items-baseline gap-1.5">
									<span className="truncate">{plural(plan.length, "want")} to buy</span>
									<Link
										href="/settings/hoshii"
										prefetch
										className="shrink-0 rounded text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
									>
										Pick a piggy
									</Link>
								</span>
							}
						/>
					)}
				</div>
				{piggy ? (
					<div className="min-w-0">
						<Figure
							index={index++}
							label="Plan"
							value={total > 0 ? `${Math.round((saved / total) * 100)}%` : null}
							note={
								total > 0
									? `${formatMoney(saved, currency, true)} of ${formatMoney(total, currency, true)}`
									: "Nothing to save for yet"
							}
						/>
						{total > 0 && (
							<span
								aria-hidden
								className="mt-1 block h-[3px] max-w-48 overflow-hidden rounded-full bg-surface-2"
							>
								<span
									className="block h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out"
									style={{ transform: `scaleX(${Math.min(1, saved / total)})` }}
								/>
							</span>
						)}
					</div>
				) : (
					<Figure
						index={index++}
						label="To decide"
						value={String(decide.length)}
						note={decide.length > 0 ? "cooled, still wanted?" : "Nothing has cooled yet"}
					/>
				)}
				{budget ? (
					<Figure
						index={index++}
						label={`Left · ${MONTH.format(new Date(`${today}T00:00:00Z`))}`}
						value={formatMoney(budget.limit - budget.spent, currency, true)}
						note={`of ${formatMoney(budget.limit, currency, true)} for ${budget.name}`}
					/>
				) : (
					<Figure
						index={index++}
						label="Cooling"
						value={String(cooling.length)}
						note={
							cooling[0] ? `next one ${formatDay(cooling[0].coolUntil, today)}` : "Nothing cooling"
						}
					/>
				)}
			</section>

			<ContextArea
				attr="data-hoshii-id"
				onTarget={(id) => {
					setMenuId(id);
					return true;
				}}
				onClose={() => setMenuId(null)}
				menu={menuItem && <RowMenu item={menuItem} today={today} actions={actions} />}
			>
				<div className="mt-10 space-y-10">
					<Section
						id="hoshii-decide"
						title="Decide"
						hint="Cooling is over. Still want it?"
						count={decide.length}
						index={3 + index++}
						empty="Nothing to decide. Wants land here when their cooling ends."
					>
						{decide.map((item) => (
							<DecideRow key={item.id} item={item} actions={actions} />
						))}
					</Section>

					<Section
						id="hoshii-plan"
						title="Plan"
						hint={plan.length > 1 ? "Drag to change what gets money first" : undefined}
						count={plan.length}
						index={3 + index++}
						empty="Keep a want after it cools and it joins the Plan."
					>
						<DndContext
							id={dndId}
							sensors={sensors}
							collisionDetection={closestCenter}
							modifiers={[restrictToVerticalAxis]}
							onDragEnd={onDragEnd}
						>
							<SortableContext
								items={plan.map((p) => p.item.id)}
								strategy={verticalListSortingStrategy}
							>
								{plan.map((entry, i) => (
									<PlanRow
										key={entry.item.id}
										entry={entry}
										rank={i + 1}
										currency={currency}
										funding={piggy != null}
										actions={actions}
									/>
								))}
							</SortableContext>
						</DndContext>
					</Section>

					<Section
						id="hoshii-cooling"
						title="Cooling"
						count={cooling.length}
						index={3 + index++}
						empty="Nothing cooling. Add a want with N."
					>
						{cooling.map((item) => (
							<CoolingRow key={item.id} item={item} today={today} actions={actions} />
						))}
					</Section>
				</div>
			</ContextArea>

			<div className="mt-6">
				<QuietAdd onClick={() => requestAdd()}>Add a want</QuietAdd>
			</div>
			{layer}
		</>
	);
}

function Section({
	id,
	title,
	hint,
	count,
	index,
	empty,
	children,
}: {
	id: string;
	title: string;
	hint?: string;
	count: number;
	index: number;
	empty: string;
	children: React.ReactNode;
}) {
	return (
		<section aria-labelledby={id} className="animate-rise" style={rise(index)}>
			<div className="flex items-baseline justify-between gap-3 px-1 pb-2">
				<div className="min-w-0 truncate text-sm">
					<h2 id={id} className="inline font-medium">
						{title}
					</h2>
					{hint && <span className="ml-2 text-muted-foreground max-sm:hidden">{hint}</span>}
				</div>
				<span className="font-figures text-xs text-muted-foreground">{count}</span>
			</div>
			{count > 0 ? (
				<ol className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">{children}</ol>
			) : (
				<p className="pt-3 text-sm text-muted-foreground">{empty}</p>
			)}
		</section>
	);
}

const ROW =
	"group relative grid items-center gap-x-3 rounded-md transition-colors duration-150 hover:bg-surface md:-mx-2 md:px-2";

/** The row's main button: what it is, a detail line; it opens the want. */
function RowMain({
	item,
	detail,
	onOpen,
	children,
}: {
	item: HoshiiItem;
	detail: React.ReactNode;
	onOpen: () => void;
	children?: React.ReactNode;
}) {
	return (
		<button
			type="button"
			data-hoshii-id={item.id}
			onClick={onOpen}
			className="min-w-0 rounded-md py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<span className="block truncate text-sm">{item.title}</span>
			<span className="block truncate text-xs text-muted-foreground">{detail}</span>
			{children}
		</button>
	);
}

const price = (item: HoshiiItem) =>
	item.price != null ? formatMoney(Number(item.price), item.currency) : "No price";

function DecideRow({ item, actions }: { item: HoshiiItem; actions: ItemActions }) {
	const waited = daysBetween(item.addedOn, item.coolUntil);
	return (
		<li data-hoshii-row className={cn(ROW, "grid-cols-[2.75rem_minmax(0,1fr)_auto]")}>
			<Thumb src={item.imageUrl} className="size-11" />
			<RowMain
				item={item}
				onOpen={() => actions.open(item)}
				detail={
					<>
						<span className="font-figures">{price(item)}</span> · waited {plural(waited, "day")}
						{item.listName && ` · ${item.listName}`}
					</>
				}
			/>
			<span className="flex gap-1.5 py-2">
				<Button
					variant="ghost"
					size="sm"
					aria-label={`${item.title}: let go`}
					aria-keyshortcuts="L"
					className="gap-1.5 text-muted-foreground max-sm:size-10 max-sm:px-0"
					onClick={() => actions.release(item)}
				>
					<HugeiconsIcon icon={Cancel01Icon} className="size-4" />
					<span className="max-sm:hidden">Let go</span>
				</Button>
				<Button
					variant="outline"
					size="sm"
					aria-label={`${item.title}: keep`}
					aria-keyshortcuts="K"
					className="gap-1.5 border-primary/50 text-primary hover:bg-primary/10 hover:text-primary max-sm:size-10 max-sm:px-0"
					onClick={() => actions.keep(item)}
				>
					<HugeiconsIcon icon={Tick02Icon} className="size-4" />
					<span className="max-sm:hidden">Keep</span>
				</Button>
			</span>
		</li>
	);
}

function PlanRow({
	entry,
	rank,
	currency,
	funding,
	actions,
}: {
	entry: PlanEntry;
	rank: number;
	currency: string;
	funding: boolean;
	actions: ItemActions;
}) {
	const { item, cost, funded, share } = entry;
	const ready = funding && share != null && share >= 1;
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.id,
		transition: SORT_TRANSITION,
	});
	// The whole row drags; its buttons stay buttons.
	const { role: _role, tabIndex: _tab, ...sortable } = attributes;
	return (
		<li
			ref={setNodeRef}
			data-hoshii-row
			{...sortable}
			{...listeners}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn(
				ROW,
				"grid-cols-[2.5rem_minmax(0,1fr)_auto] touch-manipulation sm:grid-cols-[2.5rem_2.75rem_minmax(0,1fr)_auto]",
				isDragging && "z-10 bg-surface-2 shadow-lg",
			)}
		>
			<span
				aria-hidden
				className="absolute top-1/2 -left-7 hidden w-4 -translate-y-1/2 text-right font-figures text-[11px] text-muted-foreground/70 xl:block"
			>
				{rank}
			</span>
			<button
				type="button"
				aria-label={`${item.title}: bought it`}
				aria-keyshortcuts="B"
				onClick={() => actions.buy(item)}
				className="group/act flex size-10 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span
					aria-hidden
					className={cn(
						"flex size-7 items-center justify-center rounded-full transition-[background-color,box-shadow,color,transform] duration-150 ease-out group-hover/act:bg-primary/10 group-hover/act:text-primary group-hover/act:shadow-[inset_0_0_0_1.5px_var(--primary)] group-active/act:scale-[0.94]",
						ready
							? "text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]"
							: "text-transparent shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--muted-foreground)_60%,transparent)]",
					)}
				>
					<HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={2} />
				</span>
			</button>
			<Thumb src={item.imageUrl} className="size-11 max-sm:hidden" />
			<RowMain
				item={item}
				onOpen={() => actions.open(item)}
				detail={[item.listName, linksText(item.links)].filter(Boolean).join(" · ") || "No list"}
			>
				{funding && share != null && (
					<span
						aria-hidden
						className="mt-1.5 block h-[3px] max-w-80 overflow-hidden rounded-full bg-surface-2"
					>
						<span
							className="block h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out"
							style={{ transform: `scaleX(${share})` }}
						/>
					</span>
				)}
			</RowMain>
			<span className="py-2.5 text-right">
				<span className="block whitespace-nowrap font-figures text-sm font-medium">
					{price(item)}
				</span>
				<span
					className={cn(
						"block whitespace-nowrap font-figures text-[11px]",
						ready ? "font-medium text-primary" : "text-muted-foreground",
					)}
				>
					{!funding || cost == null
						? item.currency !== currency && item.base != null
							? `≈ ${formatMoney(item.base, currency, true)}`
							: ""
						: ready
							? "Can buy"
							: funded > 0
								? `${formatMoney(funded, currency, true)} saved`
								: `${formatMoney(cost, currency, true)} to go`}
				</span>
			</span>
		</li>
	);
}

function CoolingRow({
	item,
	today,
	actions,
}: {
	item: HoshiiItem;
	today: string;
	actions: ItemActions;
}) {
	const left = daysBetween(today, item.coolUntil);
	return (
		<li data-hoshii-row className={cn(ROW, "grid-cols-[2.75rem_minmax(0,1fr)_auto]")}>
			<Thumb src={item.imageUrl} className="size-11 opacity-65" />
			<RowMain
				item={item}
				onOpen={() => actions.open(item)}
				detail={
					<>
						<span className="font-figures">{price(item)}</span>
						{item.listName && ` · ${item.listName}`}
					</>
				}
			/>
			<span className="py-2.5 text-right">
				<span className="block whitespace-nowrap font-figures text-sm font-medium">
					{plural(left, "day")}
				</span>
				<span className="block whitespace-nowrap font-figures text-[11px] text-muted-foreground">
					until {formatDay(item.coolUntil, today)}
				</span>
			</span>
		</li>
	);
}

/** The right-click menu: the want's next steps, then edit and delete. */
export function RowMenu({
	item,
	today,
	actions,
}: {
	item: HoshiiItem;
	today: string;
	actions: ItemActions;
}) {
	const stage = stageOf(item, today);
	return (
		<>
			{stage === "decide" && (
				<ContextMenuItem onSelect={() => actions.keep(item)}>
					<HugeiconsIcon icon={Tick02Icon} />
					Keep
					<ContextMenuShortcut>K</ContextMenuShortcut>
				</ContextMenuItem>
			)}
			{stage === "cooling" && (
				<ContextMenuItem onSelect={() => actions.needNow(item)}>
					<HugeiconsIcon icon={FlashIcon} />
					Need it now
				</ContextMenuItem>
			)}
			{(stage === "plan" || stage === "decide" || stage === "cooling") && (
				<ContextMenuItem onSelect={() => actions.buy(item)}>
					<HugeiconsIcon icon={ShoppingCart01Icon} />
					Bought it…
					<ContextMenuShortcut>B</ContextMenuShortcut>
				</ContextMenuItem>
			)}
			{(item.state === "cooling" || item.state === "plan") && (
				<ContextMenuItem onSelect={() => actions.release(item)}>
					<HugeiconsIcon icon={Cancel01Icon} />
					Let go
					<ContextMenuShortcut>L</ContextMenuShortcut>
				</ContextMenuItem>
			)}
			<ContextMenuItem onSelect={() => actions.edit(item)}>
				<HugeiconsIcon icon={PencilEdit01Icon} />
				Edit…
				<ContextMenuShortcut>E</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem
				className="text-destructive focus:text-destructive"
				onSelect={() => actions.remove(item)}
			>
				<HugeiconsIcon icon={Delete01Icon} />
				Delete…
				<ContextMenuShortcut>⌫</ContextMenuShortcut>
			</ContextMenuItem>
		</>
	);
}
