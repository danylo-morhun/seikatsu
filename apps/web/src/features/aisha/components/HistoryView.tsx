"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ContextArea, openContextMenu } from "@/components/ContextArea";
import { PageTitle } from "@/components/PageTitle";
import { QuietAdd } from "@/components/QuietAdd";
import type { AishaReading, ServiceWithItems } from "@/features/aisha/actions/data";
import { deleteReading } from "@/features/aisha/actions/readings";
import { deleteService } from "@/features/aisha/actions/services";
import type { ChromeData } from "@/features/aisha/components/AishaChrome";
import { ReadingDialog } from "@/features/aisha/components/ReadingDialog";
import { ServiceDialog } from "@/features/aisha/components/ServiceDialog";
import { requestLogService, requestMileage } from "@/features/aisha/lib/events";
import { formatDate, formatKm, formatKmDelta, formatMoney } from "@/features/aisha/lib/format";
import { moveRowFocus, targetRow } from "@/features/aisha/lib/keys";
import { pageKey } from "@/lib/capture-shortcut";
import { Delete01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, cn } from "@seikatsu/ui";
import Link from "next/link";
import {
	type CSSProperties,
	memo,
	useEffect,
	useOptimistic,
	useRef,
	useState,
	useTransition,
} from "react";
import { toast } from "sonner";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;
const FAILED = { error: "Couldn't save. Check your connection." };

export type HistoryReading = AishaReading & { delta: number | null };
type Target = { kind: "service"; id: string } | { kind: "reading"; id: string };

const ROW =
	"group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-md transition-colors duration-150 hover:bg-surface-2 md:-mx-2 md:px-2";
const MAIN =
	"min-w-0 rounded-md py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-0";

/** History: every garage visit and every odometer reading, each one editable. */
export function HistoryView({
	car,
	services: savedServices,
	serviceCount,
	readings: savedReadings,
}: {
	car: ChromeData;
	/** The latest visits; all of them with ?all. */
	services: ServiceWithItems[];
	serviceCount: number;
	readings: HistoryReading[];
}) {
	const [, startTransition] = useTransition();
	const [services, removeService] = useOptimistic(savedServices, (list, id: string) =>
		list.filter((s) => s.id !== id),
	);
	const [readings, removeReading] = useOptimistic(savedReadings, (list, id: string) =>
		list.filter((r) => r.id !== id),
	);
	const [editing, setEditing] = useState<(Target & { instant: boolean }) | null>(null);
	const [deleting, setDeleting] = useState<Target | null>(null);
	const [menu, setMenu] = useState<Target | null>(null);

	const serviceOf = (id: string) => services.find((s) => s.id === id);
	const readingOf = (id: string) => readings.find((r) => r.id === id);
	/** A reading from a visit is that visit's: it opens and goes with it. */
	const resolve = (t: Target): Target => {
		if (t.kind === "reading") {
			const r = readingOf(t.id);
			if (r?.serviceRecordId && serviceOf(r.serviceRecordId)) {
				return { kind: "service", id: r.serviceRecordId };
			}
		}
		return t;
	};
	const parse = (raw: string): Target | null => {
		const [kind, id] = raw.split(":");
		return kind === "service" || kind === "reading" ? { kind, id } : null;
	};

	function remove(t: Target) {
		startTransition(async () => {
			if (t.kind === "service") removeService(t.id);
			else removeReading(t.id);
			const result = await (t.kind === "service" ? deleteService(t.id) : deleteReading(t.id)).catch(
				() => FAILED,
			);
			if ("error" in result) toast.error(result.error);
		});
	}

	// ── Keys: on the row in focus or under the pointer ──
	const keyRef = useRef<(key: string, e: KeyboardEvent) => boolean>(() => false);
	keyRef.current = (key, e) => {
		const el = targetRow();
		const raw = el?.dataset.aishaId;
		const t = raw ? parse(raw) : null;
		if (!el || !t) return false;
		if (key === "e") setEditing({ ...resolve(t), instant: !e.repeat });
		else if (key === "delete") setDeleting(resolve(t));
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

	const editingService = editing?.kind === "service" ? (serviceOf(editing.id) ?? null) : null;
	const editingReading = editing?.kind === "reading" ? (readingOf(editing.id) ?? null) : null;
	const deletingService = deleting?.kind === "service" ? serviceOf(deleting.id) : undefined;
	const deletingReading = deleting?.kind === "reading" ? readingOf(deleting.id) : undefined;
	const onlyReading = readings.length <= 1;

	return (
		<>
			<PageTitle title="History" />
			<ContextArea
				attr="data-aisha-id"
				onTarget={(raw) => {
					const t = parse(raw);
					if (!t) return false;
					setMenu(resolve(t));
					return true;
				}}
				onClose={() => setMenu(null)}
				menu={
					menu && (
						<>
							<ContextMenuItem onSelect={() => setEditing({ ...menu, instant: false })}>
								<HugeiconsIcon icon={PencilEdit01Icon} />
								Edit…
								<ContextMenuShortcut>E</ContextMenuShortcut>
							</ContextMenuItem>
							{!(menu.kind === "reading" && onlyReading) && (
								<>
									<ContextMenuSeparator />
									<ContextMenuItem
										className="text-destructive focus:text-destructive"
										onSelect={() => setDeleting(menu)}
									>
										<HugeiconsIcon icon={Delete01Icon} />
										Delete…
										<ContextMenuShortcut>⌫</ContextMenuShortcut>
									</ContextMenuItem>
								</>
							)}
						</>
					)
				}
			>
				<div className="grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
					<section aria-labelledby="aisha-services" className="animate-rise" style={rise(0)}>
						<div className="flex items-baseline justify-between gap-3 px-1 pb-2">
							<h2 id="aisha-services" className="text-sm font-medium">
								Services
							</h2>
							<span className="font-figures text-xs text-muted-foreground">{serviceCount}</span>
						</div>
						{services.length === 0 ? (
							<p className="py-6 text-sm text-muted-foreground">
								No visits logged yet. Log one after the garage: what was done, the mileage, the
								bill.
							</p>
						) : (
							<ol className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">
								{services.map((s) => (
									<ServiceRow
										key={s.id}
										service={s}
										onOpen={(id) => setEditing({ kind: "service", id, instant: false })}
									/>
								))}
							</ol>
						)}
						<div className="mt-2 flex flex-wrap items-center justify-between gap-x-6">
							<QuietAdd onClick={() => requestLogService()} aria-keyshortcuts="N">
								Log a service
							</QuietAdd>
							{services.length < serviceCount && (
								<Link
									href="/aisha/history?all=1"
									prefetch
									scroll={false}
									className="text-sm text-muted-foreground transition-colors hover:text-foreground"
								>
									Show all <span className="font-figures">{serviceCount}</span>
								</Link>
							)}
						</div>
					</section>

					<section aria-labelledby="aisha-readings" className="animate-rise" style={rise(1)}>
						<div className="flex items-baseline justify-between gap-3 px-1 pb-2">
							<h2 id="aisha-readings" className="text-sm font-medium">
								Mileage
							</h2>
							<span className="font-figures text-xs text-muted-foreground">{readings.length}</span>
						</div>
						<ol className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">
							{readings.map((r) => (
								<ReadingRow
									key={r.id}
									reading={r}
									onOpen={() =>
										setEditing({
											...resolve({ kind: "reading", id: r.id }),
											instant: false,
										})
									}
								/>
							))}
						</ol>
						<QuietAdd className="mt-2" onClick={requestMileage} aria-keyshortcuts="M">
							Add a reading
						</QuietAdd>
					</section>
				</div>
			</ContextArea>

			<ServiceDialog
				open={editingService != null}
				instant={editing?.instant}
				onOpenChange={(open) => !open && setEditing(null)}
				service={editingService}
				vehicleId={car.vehicleId}
				workspaceId={car.workspaceId}
				currentKm={car.currentKm}
				items={car.items}
				kurojiDefaults={car.kurojiDefaults}
			/>
			<ReadingDialog
				open={editingReading != null}
				instant={editing?.instant}
				onOpenChange={(open) => !open && setEditing(null)}
				reading={editingReading}
				vehicleId={car.vehicleId}
				currentKm={car.currentKm}
			/>
			<ConfirmDelete
				open={deleting != null}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={
					deletingService
						? `Delete the visit of ${formatDate(deletingService.date)}?`
						: `Delete the reading of ${deletingReading ? formatDate(deletingReading.date) : ""}?`
				}
				description={
					deletingService
						? `Its items count from their visit before this one, and its reading goes too.${
								deletingService.kurojiTransactionId ? " The expense stays in Kuroji." : ""
							}`
						: "Due dates are worked out again from the other readings."
				}
				onConfirm={() => {
					if (deleting) remove(deleting);
					return undefined;
				}}
			/>
		</>
	);
}

// Memoized: a save re-renders the page; unchanged rows skip.
const ServiceRow = memo(function ServiceRow({
	service: s,
	onOpen,
}: {
	service: ServiceWithItems;
	onOpen: (id: string) => void;
}) {
	const meta = [formatDate(s.date), formatKm(s.km), s.shop].filter(Boolean).join(" · ");
	return (
		<li data-aisha-row className={cn(ROW, "relative")}>
			<button
				type="button"
				data-aisha-id={`service:${s.id}`}
				onClick={() => onOpen(s.id)}
				className={MAIN}
			>
				<span className="block truncate text-sm">
					{s.items.length > 0 ? s.items.map((i) => i.name).join(", ") : "Visit"}
				</span>
				<span className="block truncate text-xs text-muted-foreground">
					{meta}
					{s.note && ` · ${s.note}`}
				</span>
			</button>
			<span className="text-right">
				<span className="block whitespace-nowrap font-figures text-sm font-medium">
					{s.cost != null ? formatMoney(Number(s.cost), s.currency) : "—"}
				</span>
				{s.kurojiTransactionId && (
					<span className="block text-[11px] text-muted-foreground">In Kuroji</span>
				)}
			</span>
		</li>
	);
}, sameService);

function sameService(
	a: { service: ServiceWithItems; onOpen: unknown },
	b: { service: ServiceWithItems; onOpen: unknown },
) {
	const x = a.service;
	const y = b.service;
	return (
		a.onOpen === b.onOpen &&
		x.id === y.id &&
		x.date === y.date &&
		x.km === y.km &&
		x.cost === y.cost &&
		x.currency === y.currency &&
		x.shop === y.shop &&
		x.note === y.note &&
		x.kurojiTransactionId === y.kurojiTransactionId &&
		x.items.map((i) => i.id).join() === y.items.map((i) => i.id).join()
	);
}

function ReadingRow({ reading: r, onOpen }: { reading: HistoryReading; onOpen: () => void }) {
	return (
		<li data-aisha-row className={cn(ROW, "relative")}>
			<button type="button" data-aisha-id={`reading:${r.id}`} onClick={onOpen} className={MAIN}>
				<span className="block truncate text-sm">{formatDate(r.date)}</span>
				<span className="block truncate text-xs text-muted-foreground">
					{r.serviceRecordId ? "At a service" : "Odometer"}
				</span>
			</button>
			<span className="text-right">
				<span className="block whitespace-nowrap font-figures text-sm font-medium">
					{formatKm(r.km)}
				</span>
				{r.delta != null && (
					<span className="block whitespace-nowrap font-figures text-[11px] text-muted-foreground">
						{formatKmDelta(r.delta)}
					</span>
				)}
			</span>
		</li>
	);
}
