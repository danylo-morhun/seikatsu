"use client";

import type { AishaDashboard as Data } from "@/features/aisha/actions/data";
import { deleteService } from "@/features/aisha/actions/services";
import { DocumentModal } from "@/features/aisha/components/DocumentModal";
import { ItemModal } from "@/features/aisha/components/ItemModal";
import { LogServiceModal } from "@/features/aisha/components/LogServiceModal";
import { UpdateMileageModal } from "@/features/aisha/components/UpdateMileageModal";
import { STATUS_LABELS } from "@/features/aisha/lib/constants";
import type { DueStatus } from "@/features/aisha/lib/due";
import {
	dueSummary,
	formatDate,
	formatDays,
	formatKm,
	intervalSummary,
} from "@/features/aisha/lib/format";
import { Add01Icon, Delete02Icon, Tick02Icon, WrenchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import { memo, useCallback, useOptimistic, useTransition } from "react";
import { toast } from "sonner";

const STATUS_STYLES: Record<DueStatus, string> = {
	overdue: "bg-red-500/15 text-red-400 ring-red-500/30",
	soon: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
	unknown: "bg-muted text-muted-foreground ring-border",
	ok: "bg-primary/10 text-primary ring-primary/20",
};

function StatusBadge({ status }: { status: DueStatus }) {
	return (
		<span
			className={cn(
				"shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
				STATUS_STYLES[status],
			)}
		>
			{STATUS_LABELS[status]}
		</span>
	);
}

function Section({
	title,
	action,
	children,
}: {
	title: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section>
			<div className="mb-2 flex items-center justify-between">
				<h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
				{action}
			</div>
			{children}
		</section>
	);
}

export function AishaDashboard({ data, today }: { data: Data; today: string }) {
	const { vehicle, currentKm, kmPerDay, items, documents } = data;
	const [, startTransition] = useTransition();
	// Deleted rows disappear at once; the action's re-render brings the saved list.
	const [services, removeService] = useOptimistic(data.services, (list, id: string) =>
		list.filter((s) => s.id !== id),
	);

	const onDeleteService = useCallback(
		(id: string) => {
			if (!confirm("Delete this service record?")) return;
			startTransition(async () => {
				removeService(id);
				const res = await deleteService(id);
				if ("error" in res) toast.error(res.error);
			});
		},
		[removeService],
	);
	const itemOptions = items.map((i) => ({ id: i.id, name: i.name }));
	const attention =
		items.filter((i) => i.due.status === "overdue" || i.due.status === "soon").length +
		documents.filter((d) => d.status !== "ok").length;
	const unknown = items.filter((i) => i.due.status === "unknown").length;

	return (
		<div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
			<div className="mb-6 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-lg font-semibold">
						{vehicle.make} {vehicle.model}{" "}
						<span className="font-normal text-muted-foreground">{vehicle.year}</span>
					</h1>
					<p className="text-sm text-muted-foreground">
						{[vehicle.engine, vehicle.plate].filter(Boolean).join(" · ")}
					</p>
					<p className="mt-2 text-2xl font-semibold tabular-nums">{formatKm(currentKm)}</p>
					<p className="text-xs text-muted-foreground">
						{kmPerDay
							? `~${formatKm(Math.round(kmPerDay * 30))} / month`
							: "Update mileage now and then to estimate due dates"}
					</p>
				</div>
				<div className="flex gap-2">
					<UpdateMileageModal
						vehicleId={vehicle.id}
						currentKm={currentKm}
						trigger={
							<Button size="sm" variant="outline">
								Update mileage
							</Button>
						}
					/>
					<LogServiceModal
						vehicleId={vehicle.id}
						currentKm={currentKm}
						items={itemOptions}
						trigger={
							<Button size="sm" className="gap-1.5">
								<HugeiconsIcon icon={WrenchIcon} className="h-4 w-4" />
								Log service
							</Button>
						}
					/>
				</div>
			</div>

			{(attention > 0 || unknown > 0) && (
				<div className="mb-6 rounded-lg border border-border/60 bg-card px-4 py-3 text-sm">
					{attention > 0 && (
						<p>
							<span className="font-medium text-amber-400">{attention}</span> thing
							{attention === 1 ? " needs" : "s need"} attention.
						</p>
					)}
					{unknown > 0 && (
						<p className="text-muted-foreground">
							{unknown} item{unknown === 1 ? " has" : "s have"} no record yet. After your first
							service, log everything that was done so Aisha can count from there.
						</p>
					)}
				</div>
			)}

			<div className="flex flex-col gap-8">
				<Section
					title="Documents"
					action={
						<DocumentModal
							vehicleId={vehicle.id}
							trigger={
								<Button size="sm" variant="ghost" className="gap-1.5">
									<HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
									Add
								</Button>
							}
						/>
					}
				>
					{documents.length === 0 ? (
						<p className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
							Add your OC insurance and technical inspection (przegląd) dates.
						</p>
					) : (
						<ul className="divide-y divide-border/50 rounded-lg border border-border/60">
							{documents.map((d) => (
								<li key={d.id}>
									<DocumentModal
										vehicleId={vehicle.id}
										doc={d}
										trigger={
											<button
												type="button"
												className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
											>
												<div className="min-w-0 flex-1">
													<p className="truncate text-sm font-medium">{d.name}</p>
													<p className="text-xs text-muted-foreground">
														Until {formatDate(d.expiresOn)} · {d.daysLeft < 0 ? "expired " : ""}
														{formatDays(d.daysLeft)}
													</p>
												</div>
												<StatusBadge status={d.status} />
											</button>
										}
									/>
								</li>
							))}
						</ul>
					)}
				</Section>

				<Section
					title="Maintenance"
					action={
						<ItemModal
							vehicleId={vehicle.id}
							trigger={
								<Button size="sm" variant="ghost" className="gap-1.5">
									<HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
									Add
								</Button>
							}
						/>
					}
				>
					<ul className="divide-y divide-border/50 rounded-lg border border-border/60">
						{items.map((item) => (
							<li key={item.id} className="flex items-center gap-2 pr-2">
								<ItemModal
									vehicleId={vehicle.id}
									item={item}
									trigger={
										<button
											type="button"
											className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
										>
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium">{item.name}</p>
												<p className="text-xs text-muted-foreground">
													{dueSummary(item.due, today)}
												</p>
												<p className="text-[11px] text-muted-foreground/70">
													{intervalSummary(item.intervalKm, item.intervalMonths)}
													{item.lastDone &&
														` · last ${formatDate(item.lastDone.date)} at ${formatKm(item.lastDone.km)}`}
												</p>
											</div>
											<StatusBadge status={item.due.status} />
										</button>
									}
								/>
								<LogServiceModal
									vehicleId={vehicle.id}
									currentKm={currentKm}
									items={itemOptions}
									preselected={[item.id]}
									trigger={
										<Button
											size="icon"
											variant="ghost"
											className="h-8 w-8 shrink-0"
											title="Mark done"
										>
											<HugeiconsIcon icon={Tick02Icon} className="h-4 w-4" />
										</Button>
									}
								/>
							</li>
						))}
					</ul>
				</Section>

				<Section title="Service history">
					{services.length === 0 ? (
						<p className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
							Nothing logged yet.
						</p>
					) : (
						<ul className="divide-y divide-border/50 rounded-lg border border-border/60">
							{services.map((s) => (
								<ServiceRow key={s.id} service={s} onDelete={onDeleteService} />
							))}
						</ul>
					)}
				</Section>
			</div>
		</div>
	);
}

type Service = Data["services"][number];

// Memoized: a save re-renders the whole dashboard; unchanged history rows skip.
const ServiceRow = memo(function ServiceRow({
	service: s,
	onDelete,
}: {
	service: Service;
	onDelete: (id: string) => void;
}) {
	return (
		<li className="flex items-start gap-3 px-4 py-3">
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium">
					{formatDate(s.date)}{" "}
					<span className="font-normal text-muted-foreground">· {formatKm(s.km)}</span>
				</p>
				<p className="text-xs text-muted-foreground">{s.items.map((i) => i.name).join(", ")}</p>
				{(s.shop || s.note) && (
					<p className="text-[11px] text-muted-foreground/70">
						{[s.shop, s.note].filter(Boolean).join(" · ")}
					</p>
				)}
			</div>
			{s.cost != null && (
				<span className="shrink-0 text-sm tabular-nums">
					{Number(s.cost).toFixed(2)} {s.currency}
				</span>
			)}
			<Button
				size="icon"
				variant="ghost"
				className="h-8 w-8 shrink-0 text-muted-foreground"
				onClick={() => onDelete(s.id)}
				title="Delete"
			>
				<HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
			</Button>
		</li>
	);
}, sameServiceRow);

// Field-wise: a server re-render sends new objects for unchanged records.
function sameServiceRow(
	a: { service: Service; onDelete: unknown },
	b: { service: Service; onDelete: unknown },
) {
	const x = a.service;
	const y = b.service;
	return (
		a.onDelete === b.onDelete &&
		x.id === y.id &&
		x.date === y.date &&
		x.km === y.km &&
		x.cost === y.cost &&
		x.currency === y.currency &&
		x.shop === y.shop &&
		x.note === y.note &&
		x.items.map((i) => i.name).join() === y.items.map((i) => i.name).join()
	);
}
