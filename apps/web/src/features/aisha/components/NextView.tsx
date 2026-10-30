"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ContextArea, openContextMenu } from "@/components/ContextArea";
import { PageTitle } from "@/components/PageTitle";
import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import type {
	AishaCar,
	DocumentWithDue,
	ItemWithDue,
	QueueEntry,
} from "@/features/aisha/actions/data";
import { deleteDocument } from "@/features/aisha/actions/documents";
import { clearBaselines, countDoneAtPurchase, deleteItem } from "@/features/aisha/actions/items";
import { DocumentDialog } from "@/features/aisha/components/DocumentDialog";
import { FIGURES_ROW, Figure } from "@/features/aisha/components/Figure";
import { ItemDialog } from "@/features/aisha/components/ItemDialog";
import { DOCUMENT_TYPE_LABELS } from "@/features/aisha/lib/constants";
import { daysBetween } from "@/features/aisha/lib/due";
import { requestLogService, requestMileage } from "@/features/aisha/lib/events";
import {
	formatDate,
	formatDays,
	formatKm,
	formatMoney,
	formatNumber,
	fromToday,
	intervalSummary,
} from "@/features/aisha/lib/format";
import { moveRowFocus, targetRow } from "@/features/aisha/lib/keys";
import type { Queued } from "@/features/aisha/lib/queue";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Delete01Icon,
	PencilEdit01Icon,
	RefreshIcon,
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
import { type CSSProperties, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;
const FAILED = { error: "Couldn't save. Check your connection." };

type Editing =
	| { kind: "item"; item: ItemWithDue | null; instant: boolean }
	| { kind: "document"; doc: DocumentWithDue | null; renew: boolean; instant: boolean };
type Deleting = { kind: "item"; item: ItemWithDue } | { kind: "document"; doc: DocumentWithDue };

const keyOf = (e: QueueEntry) => (e.kind === "item" ? e.item.id : e.doc.id);

/** Next: the odometer, then everything the car needs, most urgent first. */
export function NextView({
	car,
	today,
	spent,
}: {
	car: Pick<AishaCar, "vehicle" | "queue" | "firstReading" | "currentKm" | "kmPerDay"> & {
		documentCount: number;
	};
	today: string;
	/** This calendar year's service spend. */
	spent: { amount: number; services: number; currency: string };
}) {
	const { vehicle, queue, firstReading } = car;
	const [editing, setEditing] = useState<Editing | null>(null);
	const [deleting, setDeleting] = useState<Deleting | null>(null);
	const [menuId, setMenuId] = useState<string | null>(null);
	const [counting, startCount] = useTransition();

	const all = [...queue.due, ...queue.later, ...queue.unknown];
	const find = (id: string) => all.find((q) => keyOf(q.entry) === id)?.entry;
	const next = queue.due[0] ?? queue.later[0];

	function act(entry: QueueEntry, instant: boolean) {
		if (entry.kind === "item") requestLogService([entry.item.id]);
		else setEditing({ kind: "document", doc: entry.doc, renew: true, instant });
	}
	function edit(entry: QueueEntry, instant: boolean) {
		setEditing(
			entry.kind === "item"
				? { kind: "item", item: entry.item, instant }
				: { kind: "document", doc: entry.doc, renew: false, instant },
		);
	}

	function countAtPurchase() {
		startCount(async () => {
			const result = await countDoneAtPurchase(vehicle.id).catch(() => FAILED);
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			const { ids } = result.data;
			toast(`${ids.length} ${ids.length === 1 ? "item counts" : "items count"} from the purchase`, {
				action: {
					label: "Undo",
					onClick: () =>
						void clearBaselines(vehicle.id, ids).then((r) => "error" in r && toast.error(r.error)),
				},
			});
		});
	}

	// ── Keys: on the row in focus or under the pointer ──
	const keyRef = useRef<(key: string, e: KeyboardEvent) => boolean>(() => false);
	keyRef.current = (key, e) => {
		const el = targetRow();
		const entry = el?.dataset.aishaId ? find(el.dataset.aishaId) : undefined;
		if (!el || !entry) return false;
		const instant = !e.repeat;
		if (key === "x") act(entry, instant);
		else if (key === "e") edit(entry, instant);
		else if (key === "delete")
			setDeleting(
				entry.kind === "item"
					? { kind: "item", item: entry.item }
					: { kind: "document", doc: entry.doc },
			);
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

	const menuEntry = menuId ? find(menuId) : undefined;
	const showBaseline = queue.unknown.some((q) => q.entry.kind === "item") && firstReading != null;
	let index = 0;
	const section = (title: string, list: Queued<QueueEntry>[], id: string) =>
		list.length > 0 && (
			<section aria-labelledby={id} className="animate-rise" style={rise(4 + index++)}>
				<div className="flex items-baseline justify-between gap-3 px-1 pb-2">
					<h2 id={id} className="text-sm font-medium">
						{title}
					</h2>
					<span className="font-figures text-xs text-muted-foreground">{list.length}</span>
				</div>
				<ol className="inset-group rounded-2xl bg-surface px-4 py-2 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent">
					{list.map((q) => (
						<QueueRow
							key={keyOf(q.entry)}
							queued={q}
							today={today}
							onAct={() => act(q.entry, false)}
							onOpen={() => edit(q.entry, false)}
						/>
					))}
				</ol>
			</section>
		);

	return (
		<>
			<PageTitle title="Next" subtitle={`${vehicle.make} ${vehicle.model}`} />
			<section
				aria-label="The car at a glance"
				className={`${FIGURES_ROW} md:grid-cols-[1.4fr_1fr_1fr]`}
			>
				<div className="col-span-2 md:col-span-1">
					<Figure
						lead
						index={0}
						label={`Odometer · ${vehicle.make} ${vehicle.model}`}
						value={formatNumber(car.currentKm)}
						unit="km"
						note={
							<span className="flex min-w-0 items-baseline gap-1.5">
								<span className="truncate">
									{car.kmPerDay
										? `≈ ${formatKm(car.kmPerDay * 30)} a month`
										: "Update it now and then: due dates follow your driving"}
								</span>
								<button
									type="button"
									aria-keyshortcuts="M"
									onClick={requestMileage}
									className="shrink-0 rounded text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
								>
									Update
								</button>
							</span>
						}
					/>
				</div>
				<Figure
					index={1}
					label="Next up"
					value={next ? whenText(next, today) : null}
					note={next ? entryName(next.entry) : "Nothing scheduled yet"}
				/>
				<Figure
					index={2}
					label={`Spent · ${today.slice(0, 4)}`}
					value={formatMoney(spent.amount, spent.currency)}
					note={`${spent.services} ${spent.services === 1 ? "service" : "services"}`}
				/>
			</section>

			{showBaseline && firstReading && (
				<section
					aria-labelledby="aisha-baseline"
					className="mt-10 animate-rise border-y border-rule py-5"
					style={rise(3)}
				>
					<h2 id="aisha-baseline" className="text-sm font-medium">
						When was everything last done?
					</h2>
					<p className="mt-1 max-w-prose text-sm text-muted-foreground">
						Aisha counts each item from its last service. If the car was serviced when you got it,
						count everything as done then: {formatDate(firstReading.date)}, at{" "}
						{formatKm(firstReading.km)}. A service you log later takes over.
					</p>
					<div className="mt-4 flex flex-wrap gap-2">
						<Button className="gap-1.5" disabled={counting} onClick={countAtPurchase}>
							{counting && <Spinner />}
							{counting ? "Counting…" : "Count as done at purchase"}
						</Button>
						<Button variant="ghost" onClick={() => requestLogService()}>
							Log the last service
						</Button>
					</div>
				</section>
			)}

			<ContextArea
				attr="data-aisha-id"
				onTarget={(id) => {
					setMenuId(id);
					return true;
				}}
				onClose={() => setMenuId(null)}
				menu={
					menuEntry && (
						<>
							<ContextMenuItem onSelect={() => act(menuEntry, false)}>
								<HugeiconsIcon icon={menuEntry.kind === "item" ? Tick02Icon : RefreshIcon} />
								{menuEntry.kind === "item" ? "Log as done…" : "Renew…"}
								<ContextMenuShortcut>X</ContextMenuShortcut>
							</ContextMenuItem>
							<ContextMenuItem onSelect={() => edit(menuEntry, false)}>
								<HugeiconsIcon icon={PencilEdit01Icon} />
								Edit…
								<ContextMenuShortcut>E</ContextMenuShortcut>
							</ContextMenuItem>
							<ContextMenuSeparator />
							<ContextMenuItem
								className="text-destructive focus:text-destructive"
								onSelect={() =>
									setDeleting(
										menuEntry.kind === "item"
											? { kind: "item", item: menuEntry.item }
											: { kind: "document", doc: menuEntry.doc },
									)
								}
							>
								<HugeiconsIcon icon={Delete01Icon} />
								Delete…
								<ContextMenuShortcut>⌫</ContextMenuShortcut>
							</ContextMenuItem>
						</>
					)
				}
			>
				<div className="mt-10 space-y-10">
					{section("Due", queue.due, "aisha-due")}
					{section("Coming up", queue.later, "aisha-later")}
					{section("Never logged", queue.unknown, "aisha-unknown")}
				</div>
			</ContextArea>

			<div className="mt-6 flex flex-wrap gap-x-6">
				<QuietAdd
					onClick={() => setEditing({ kind: "document", doc: null, renew: false, instant: false })}
				>
					{car.documentCount === 0 ? "Add insurance or inspection" : "Add a document"}
				</QuietAdd>
				<QuietAdd onClick={() => setEditing({ kind: "item", item: null, instant: false })}>
					Add a maintenance item
				</QuietAdd>
			</div>

			<ItemDialog
				open={editing?.kind === "item"}
				instant={editing?.instant}
				onOpenChange={(open) => !open && setEditing(null)}
				vehicleId={vehicle.id}
				item={editing?.kind === "item" ? editing.item : null}
			/>
			<DocumentDialog
				open={editing?.kind === "document"}
				instant={editing?.instant}
				onOpenChange={(open) => !open && setEditing(null)}
				vehicleId={vehicle.id}
				doc={editing?.kind === "document" ? editing.doc : null}
				renew={editing?.kind === "document" && editing.renew}
			/>
			<ConfirmDelete
				open={deleting != null}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete “${deleting ? (deleting.kind === "item" ? deleting.item.name : deleting.doc.name) : ""}”?`}
				description={
					deleting?.kind === "item"
						? "It leaves the plan and past services no longer list it. The services themselves stay."
						: "Aisha stops reminding you about it."
				}
				onConfirm={async () => {
					if (!deleting) return;
					const result = await (deleting.kind === "item"
						? deleteItem(deleting.item.id)
						: deleteDocument(deleting.doc.id)
					).catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
				}}
			/>
		</>
	);
}

function entryName(entry: QueueEntry) {
	return entry.kind === "item" ? entry.item.name : entry.doc.name;
}

/** The headline of a row: how far off it is, or how far past. */
function whenText(q: Queued<QueueEntry>, today: string): string {
	const { entry } = q;
	if (entry.kind === "document") {
		return entry.doc.daysLeft < 0
			? `Expired ${formatDays(entry.doc.daysLeft)}`
			: entry.doc.daysLeft === 0
				? "Ends today"
				: formatDays(entry.doc.daysLeft);
	}
	const { due } = entry.item;
	if (due.status === "unknown") return "—";
	if (due.kmLeft != null && due.kmLeft <= 0) return `${formatKm(-due.kmLeft)} over`;
	if (due.daysLeft != null && due.daysLeft <= 0) {
		return due.daysLeft === 0 ? "Due today" : `Due ${formatDays(due.daysLeft)}`;
	}
	return due.estimatedDate ? fromToday(due.estimatedDate, today) : "—";
}

/** The quieter second figure: the limit behind the headline. */
function limitText(q: Queued<QueueEntry>): string {
	const { entry } = q;
	if (entry.kind === "document") return formatDate(entry.doc.expiresOn);
	const { due } = entry.item;
	if (due.status === "unknown") return "no record";
	const parts: string[] = [];
	if (due.kmLeft != null && due.kmLeft > 0) parts.push(`${formatKm(due.kmLeft)} left`);
	if (due.dueDate) parts.push(`by ${formatDate(due.dueDate)}`);
	return parts.join(" · ");
}

function detailText(entry: QueueEntry): string {
	if (entry.kind === "document") {
		return [DOCUMENT_TYPE_LABELS[entry.doc.type], entry.doc.note].filter(Boolean).join(" · ");
	}
	const { item } = entry;
	const every = intervalSummary(item.intervalKm, item.intervalMonths);
	if (!item.lastDone) return `${every} · log when it was last done`;
	const when = `${formatDate(item.lastDone.date)} at ${formatKm(item.lastDone.km)}`;
	return `${every} · last ${when}${item.lastDone.source === "baseline" ? " (before Aisha)" : ""}`;
}

/** A queue row: the done (or renew) button, what and how often, how far off. */
function QueueRow({
	queued,
	today,
	onAct,
	onOpen,
}: {
	queued: Queued<QueueEntry>;
	today: string;
	onAct: () => void;
	onOpen: () => void;
}) {
	const { entry, status } = queued;
	const name = entryName(entry);
	const late =
		status === "overdue" ||
		(entry.kind === "document" && daysBetween(today, entry.doc.expiresOn) < 0);
	return (
		<li
			data-aisha-row
			className="group grid grid-cols-[1.375rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md transition-colors duration-150 hover:bg-surface-2 md:-mx-2 md:px-2"
		>
			<button
				type="button"
				aria-label={entry.kind === "item" ? `${name}: log as done` : `${name}: renew`}
				aria-keyshortcuts="X"
				onClick={onAct}
				className="group/act relative flex size-[22px] shrink-0 items-center justify-center rounded-full outline-none before:absolute before:-inset-[9px] before:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span
					aria-hidden
					className="flex size-[22px] items-center justify-center rounded-full text-transparent shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--muted-foreground)_60%,transparent)] transition-[background-color,box-shadow,color,transform] duration-150 ease-out group-hover/act:bg-primary/10 group-hover/act:text-primary group-hover/act:shadow-[inset_0_0_0_1.5px_var(--primary)] group-active/act:scale-[0.94]"
				>
					<HugeiconsIcon
						icon={entry.kind === "item" ? Tick02Icon : RefreshIcon}
						className="size-3"
						strokeWidth={2}
					/>
				</span>
			</button>
			<button
				type="button"
				data-aisha-id={keyOf(entry)}
				onClick={onOpen}
				className="min-w-0 rounded-md py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span className="block truncate text-sm">{name}</span>
				<span className="block truncate text-xs text-muted-foreground">{detailText(entry)}</span>
			</button>
			{/* Never logged: nothing to count down, the detail line says what to do. */}
			<span className={cn("py-2.5 text-right", status === "unknown" && "invisible")}>
				<span
					className={cn(
						"block whitespace-nowrap font-figures text-sm font-medium",
						late ? "text-negative" : status === "ok" ? "text-muted-foreground" : "text-foreground",
					)}
				>
					{whenText(queued, today)}
				</span>
				<span className="block whitespace-nowrap font-figures text-[11px] text-muted-foreground max-sm:max-w-32 max-sm:truncate">
					{limitText(queued)}
				</span>
			</span>
		</li>
	);
}
