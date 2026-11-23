"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Add01Icon,
	DragDropVerticalIcon,
	PencilEdit02Icon,
	ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDashboard } from "@/features/home/actions/dashboard";
import { HomeKeys } from "@/features/home/components/TodayIslands";
import {
	moveSlot,
	patchSlot,
	SIZE_NAMES,
	type Slot,
	SPAN,
	WIDGET_SIZES,
	type WidgetId,
	type WidgetSize,
} from "@/features/home/lib/dashboard";
import { APPS_CONFIG } from "@/lib/app-themes";
import { pageKey } from "@/lib/capture-shortcut";
import type { AppHref } from "@/lib/modules";

const nameOf = (id: WidgetId) => (id === "today" ? "To do" : APPS_CONFIG[id].name);
const themeOf = (id: WidgetId) => (id === "today" ? "" : APPS_CONFIG[id].theme);
const kanjiOf = (id: WidgetId) => (id === "today" ? "今" : APPS_CONFIG[id].kanji);

/**
 * The home's grid of widgets. Edit (E) lets the user drag them into order, size each one and
 * hide the ones they don't want; every change is saved at once. A widget shown or resized here
 * gets its new content with the saved page.
 */
export function Dashboard({
	slots: saved,
	widgets,
	header,
	children,
}: {
	/** The page's title, with Edit beside it. */
	header: ReactNode;
	/** Between the title and the grid (the capture line). */
	children: ReactNode;
	slots: Slot[];
	/** Each visible widget, rendered on the server at its saved size. */
	widgets: Partial<Record<WidgetId, ReactNode>>;
}) {
	const [slots, setSlots] = useState(saved);
	const [base, setBase] = useState(saved);
	// The saved page came back (or another device changed it): it wins.
	if (saved !== base) {
		setBase(saved);
		setSlots(saved);
	}
	const [editing, setEditing] = useState(false);
	const [, startSaving] = useTransition();

	const visible = slots.filter((s) => !s.hidden);
	const hidden = slots.filter((s) => s.hidden);
	const apps = visible.map((s) => s.id).filter((id): id is AppHref => id !== "today");

	function change(next: Slot[]) {
		setSlots(next);
		startSaving(async () => {
			const result = await saveDashboard(next).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) {
				toast.error(result.error);
				setSlots(saved);
			}
		});
	}

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape" && editing) {
				setEditing(false);
				return;
			}
			if (pageKey(e) !== "e") return;
			e.preventDefault();
			setEditing((v) => !v);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [editing]);

	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	function onDragEnd({ active, over }: DragEndEvent) {
		if (over && active.id !== over.id)
			change(moveSlot(slots, active.id as WidgetId, over.id as WidgetId));
	}

	return (
		<div className="space-y-5 md:space-y-6">
			{!editing && <HomeKeys listed={apps} />}
			<div className="flex animate-rise items-start justify-between gap-3">
				<div className="min-w-0">{header}</div>
				<Button
					variant={editing ? "default" : "ghost"}
					size="sm"
					onClick={() => setEditing((v) => !v)}
					aria-pressed={editing}
					aria-keyshortcuts="E"
					className="gap-1.5"
				>
					{!editing && <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />}
					{editing ? "Done" : "Edit"}
				</Button>
			</div>
			{editing ? (
				<p className="flex min-h-12 items-center px-1 text-sm text-muted-foreground">
					Drag to reorder, pick a size, hide what you don't need.
				</p>
			) : (
				<div className="animate-rise [--i:1]">{children}</div>
			)}
			<section aria-label="Dashboard" className="animate-rise space-y-3 [--i:2]">
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
					<SortableContext items={visible.map((s) => s.id)} strategy={rectSortingStrategy}>
						<ul className="grid grid-flow-dense grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
							{visible.map((slot) => (
								<Tile
									key={slot.id}
									slot={slot}
									editing={editing}
									onSize={(size) => change(patchSlot(slots, slot.id, { size }))}
									onHide={() => change(patchSlot(slots, slot.id, { hidden: true }))}
								>
									{widgets[slot.id] ?? <Placeholder id={slot.id} />}
								</Tile>
							))}
						</ul>
					</SortableContext>
				</DndContext>

				{visible.length === 0 && !editing && (
					<p className="rounded-group bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
						Every widget is hidden. Press Edit to bring some back.
					</p>
				)}

				{editing && (
					<div className="space-y-2 pt-3">
						{hidden.length > 0 && (
							<>
								<h2 className="px-1 text-sm font-medium">Hidden</h2>
								<ul className="flex flex-wrap gap-2">
									{hidden.map((slot) => (
										<li key={slot.id} className={themeOf(slot.id)}>
											<Button
												variant="outline"
												size="sm"
												className="gap-1.5"
												onClick={() => change(patchSlot(slots, slot.id, { hidden: false }))}
											>
												<HugeiconsIcon icon={Add01Icon} className="size-3.5" />
												<span aria-hidden className="text-primary">
													{kanjiOf(slot.id)}
												</span>
												{nameOf(slot.id)}
											</Button>
										</li>
									))}
								</ul>
							</>
						)}
						<p className="px-1 text-xs text-muted-foreground">
							An app that's off has no widget.{" "}
							<Link
								href="/settings/apps"
								className="underline underline-offset-2 hover:text-foreground"
							>
								Turn apps on or off
							</Link>
						</p>
					</div>
				)}
			</section>
		</div>
	);
}

function Tile({
	slot,
	editing,
	onSize,
	onHide,
	children,
}: {
	slot: Slot;
	editing: boolean;
	onSize: (size: WidgetSize) => void;
	onHide: () => void;
	children: ReactNode;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: slot.id, disabled: !editing });
	const name = nameOf(slot.id);
	// To do lists every app's rows: it needs at least half the width.
	const sizes = slot.id === "today" ? WIDGET_SIZES.filter((s) => s !== "s") : WIDGET_SIZES;

	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn(
				"relative min-w-0",
				SPAN[slot.size],
				isDragging && "z-10 shadow-[0_16px_32px_-12px_oklch(0_0_0/50%)]",
			)}
		>
			<div inert={editing} className={cn("h-full", editing && "pointer-events-none select-none")}>
				{children}
			</div>
			{editing && (
				<div
					className={cn(
						themeOf(slot.id),
						"absolute inset-0 flex animate-in flex-col justify-between rounded-group bg-surface p-2 ring-1 ring-primary/50 ring-inset duration-150 fade-in-0",
					)}
				>
					<div className="flex items-center justify-between gap-1">
						<button
							type="button"
							ref={setActivatorNodeRef}
							{...attributes}
							{...listeners}
							aria-label={`Move ${name}`}
							className="grid size-8 cursor-grab touch-none place-items-center rounded-button bg-card text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
						>
							<HugeiconsIcon icon={DragDropVerticalIcon} className="size-4" />
						</button>

						<button
							type="button"
							onClick={onHide}
							aria-label={`Hide ${name}`}
							className="grid size-8 place-items-center rounded-button bg-card text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						>
							<HugeiconsIcon icon={ViewOffSlashIcon} className="size-4" />
						</button>
					</div>
					<p className="flex min-w-0 items-baseline justify-center gap-2 truncate text-sm font-medium">
						<span aria-hidden className="text-lg text-primary">
							{kanjiOf(slot.id)}
						</span>
						{name}
					</p>
					<fieldset className="flex self-center rounded-button bg-card p-0.5 shadow-sm">
						<legend className="sr-only">{name} size</legend>
						{sizes.map((size) => (
							<button
								key={size}
								type="button"
								aria-pressed={slot.size === size}
								aria-label={`${SIZE_NAMES[size]} ${name}`}
								onClick={() => onSize(size)}
								className={cn(
									"h-7 min-w-8 rounded-button px-2 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
									slot.size === size
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{size.toUpperCase()}
							</button>
						))}
					</fieldset>
				</div>
			)}
		</li>
	);
}

/** A widget just shown: its content comes with the saved page. */
function Placeholder({ id }: { id: WidgetId }) {
	return (
		<div
			className={cn(
				themeOf(id),
				"flex h-full min-h-36 animate-pulse flex-col rounded-group bg-surface p-4 lg:min-h-40",
			)}
		>
			<span className="flex items-baseline gap-2 text-sm font-medium">
				<span aria-hidden className="text-primary">
					{kanjiOf(id)}
				</span>
				{nameOf(id)}
			</span>
		</div>
	);
}
