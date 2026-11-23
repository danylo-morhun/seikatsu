// The home's widgets: one per app that's on, plus the cross-app To do list. The user orders,
// sizes and hides them (stored on `workspaces.dashboard`); anything not stored yet (a new app,
// a module switched back on) joins at the end in its default size. Pure.

import { APP_HREFS, type AppHref, type ModuleHref } from "@/lib/modules";

/** "today" = To do across the apps (My day when Day is on); an app's href = that app's widget. */
export type WidgetId = AppHref | "today";
export type WidgetSize = "s" | "m" | "l";
export type Slot = { id: WidgetId; size: WidgetSize; hidden: boolean };

export const WIDGET_IDS: WidgetId[] = [...APP_HREFS, "today"];
export const WIDGET_SIZES: WidgetSize[] = ["s", "m", "l"];
export const SIZE_NAMES: Record<WidgetSize, string> = { s: "Small", m: "Medium", l: "Large" };

const isId = (v: unknown): v is WidgetId => (WIDGET_IDS as unknown[]).includes(v);
const isSize = (v: unknown): v is WidgetSize => (WIDGET_SIZES as unknown[]).includes(v);

/** Widgets whose module is on: every app that's on, and To do always. */
export function widgetsOn(on: readonly ModuleHref[]): WidgetId[] {
	return WIDGET_IDS.filter((id) => id === "today" || on.includes(id));
}

/**
 * The first look: the first two apps as medium tiles with their rows, the rest small. To do
 * repeats what the app tiles already show, so it starts hidden unless Day plans around it.
 */
export function defaultSlots(on: readonly ModuleHref[]): Slot[] {
	const apps = widgetsOn(on).filter((id) => id !== "today");
	const slots: Slot[] = apps.map((id, i) => ({ id, size: i < 2 ? "m" : "s", hidden: false }));
	return [...slots, { id: "today", size: "l", hidden: !on.includes("/day") }];
}

/** The saved layout made safe: unknown, repeated and switched-off widgets dropped; the missing
 * ones appended as the default has them. */
export function layoutOf(saved: unknown, on: readonly ModuleHref[]): Slot[] {
	const fallback = defaultSlots(on);
	if (!Array.isArray(saved)) return fallback;
	const allowed = widgetsOn(on);
	const seen = new Set<WidgetId>();
	const slots: Slot[] = [];
	for (const raw of saved) {
		if (!raw || typeof raw !== "object") continue;
		const { id, size, hidden } = raw as Record<string, unknown>;
		if (!isId(id) || !allowed.includes(id) || seen.has(id)) continue;
		seen.add(id);
		slots.push({ id, size: isSize(size) ? size : "s", hidden: hidden === true });
	}
	for (const slot of fallback) if (!seen.has(slot.id)) slots.push(slot);
	return slots;
}

/** One widget moved to another's place (drag and drop), the rest keeping their order. */
export function moveSlot(slots: Slot[], from: WidgetId, to: WidgetId): Slot[] {
	const a = slots.findIndex((s) => s.id === from);
	const b = slots.findIndex((s) => s.id === to);
	if (a < 0 || b < 0 || a === b) return slots;
	const next = [...slots];
	const [moved] = next.splice(a, 1);
	if (moved) next.splice(b, 0, moved);
	return next;
}

/** One step earlier (-1) or later (+1) among the visible widgets: the keyboard's move. */
export function stepSlot(slots: Slot[], id: WidgetId, by: -1 | 1): Slot[] {
	const visible = slots.filter((s) => !s.hidden);
	const i = visible.findIndex((s) => s.id === id);
	const target = visible[i + by];
	return i < 0 || !target ? slots : moveSlot(slots, id, target.id);
}

export const patchSlot = (slots: Slot[], id: WidgetId, patch: Partial<Omit<Slot, "id">>) =>
	slots.map((s) => (s.id === id ? { ...s, ...patch } : s));

/** What's on, with the apps in the dashboard's order (hidden widgets after the shown ones): the
 * order the sidebar, the app switcher and the phone's bar list them in. */
export function inDashboardOrder(on: readonly ModuleHref[], saved: unknown): ModuleHref[] {
	const slots = layoutOf(saved, on);
	const apps = [...slots.filter((s) => !s.hidden), ...slots.filter((s) => s.hidden)]
		.map((s) => s.id)
		.filter((id): id is AppHref => id !== "today");
	return [...apps, ...on.filter((m) => !(APP_HREFS as string[]).includes(m))];
}

/** The grid's columns for a size: two on a phone, four on a desktop. */
export const SPAN: Record<WidgetSize, string> = {
	s: "col-span-1",
	m: "col-span-2",
	l: "col-span-2 lg:col-span-4",
};
