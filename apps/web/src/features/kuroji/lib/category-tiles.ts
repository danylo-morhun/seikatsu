// Which categories the capture form offers as one-tap tiles.

import { isUncategorized } from "@/features/kuroji/lib/quick-categorize";

type Category = { id: string; name: string; parentId: string | null };

/** Categories you can post to (no sub-accounts), matching the search, recent first, then A–Z. */
export function postableCategories<C extends Category>(
	categories: C[],
	recentIds: string[],
	query = "",
): C[] {
	const parents = new Set(categories.map((c) => c.parentId).filter(Boolean));
	const q = query.trim().toLowerCase();
	const rank = (id: string) => {
		const i = recentIds.indexOf(id);
		return i === -1 ? Number.POSITIVE_INFINITY : i;
	};
	return categories
		.filter((c) => !parents.has(c.id) && c.name.toLowerCase().includes(q))
		.sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
}

/**
 * `count` tiles: recent categories first, topped up A–Z (never with the "Uncategorized"
 * fallback). A chosen category outside them takes the last tile, so the choice stays visible.
 */
export function categoryTiles<C extends Category>(
	categories: C[],
	opts: { recentIds: string[]; selectedId?: string; count: number },
): C[] {
	const tiles = postableCategories(categories, opts.recentIds)
		.filter((c) => opts.recentIds.includes(c.id) || !isUncategorized(c.name))
		.slice(0, opts.count);
	const selected = categories.find((c) => c.id === opts.selectedId);
	if (!selected || tiles.some((c) => c.id === selected.id)) return tiles;
	return [...tiles.slice(0, opts.count - 1), selected];
}
