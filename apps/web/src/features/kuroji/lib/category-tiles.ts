// Which categories the capture form offers as one-tap tiles: the ones used most.

import { isSystemCategory } from "@/features/kuroji/lib/category-groups";
import { isUncategorized } from "@/features/kuroji/lib/quick-categorize";

type Category = { id: string; name: string; parentId: string | null };

/** Transaction entries per category id. */
export type CategoryUsage = Record<string, number>;

/** Fewer recent entries than this say little about habits; all time decides then. */
const RECENT_MIN_ENTRIES = 20;

/** Recent usage, unless it is too sparse to rank by; then all-time usage. */
export function pickUsage(recent: CategoryUsage, allTime: CategoryUsage): CategoryUsage {
	const entries = Object.values(recent).reduce((n, c) => n + c, 0);
	return entries >= RECENT_MIN_ENTRIES ? recent : allTime;
}

/**
 * `count` tiles: the most used postable categories (no parents with sub-accounts), ties A–Z.
 * The "Uncategorized" fallback and system accounts stay off unless nothing else exists.
 * A chosen category outside them takes the last tile, so the choice stays visible.
 */
export function categoryTiles<C extends Category>(
	categories: C[],
	opts: { usage: CategoryUsage; selectedId?: string; count: number },
): C[] {
	const parents = new Set(categories.map((c) => c.parentId).filter(Boolean));
	const postable = categories.filter((c) => !parents.has(c.id));
	const preferred = postable.filter((c) => !isUncategorized(c.name) && !isSystemCategory(c.name));
	const uses = (c: C) => opts.usage[c.id] ?? 0;
	const tiles = (preferred.length > 0 ? preferred : postable)
		.sort((a, b) => uses(b) - uses(a) || a.name.localeCompare(b.name))
		.slice(0, opts.count);
	const selected = categories.find((c) => c.id === opts.selectedId);
	if (!selected || tiles.some((c) => c.id === selected.id)) return tiles;
	return [...tiles.slice(0, opts.count - 1), selected];
}
