// How the capture form lists categories: recent picks first, then every postable category
// under its parent, narrowed by a search.

type Category = { id: string; name: string; parentId: string | null };

export type CategoryOption = { id: string; label: string; hint?: string };
export type CategoryGroup = { key: string; heading: string | null; options: CategoryOption[] };

const RECENT_MAX = 5;

// System account the starter ledger uses for opening balances; never a place to post to.
const SYSTEM_NAMES = new Set(["Opening Balance"]);

/** Lowercase text without accents, so "cafe" finds "Café". */
export function searchKey(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();
}

/**
 * A parent with sub-accounts is a heading and only its sub-accounts can be picked. A value
 * that already points at a parent (older transactions) stays pickable so editing keeps it.
 * The search matches a category or its parent; "Recent" shows only while not searching.
 */
export function categoryGroups<C extends Category>(
	categories: C[],
	opts: { value: string; recentIds: string[]; query: string },
): CategoryGroup[] {
	const visible = categories.filter((c) => !SYSTEM_NAMES.has(c.name) || c.id === opts.value);
	const ids = new Set(visible.map((c) => c.id));
	const childrenOf = new Map<string, C[]>();
	for (const c of visible) {
		if (c.parentId && ids.has(c.parentId)) {
			childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c]);
		}
	}
	const byName = (a: C, b: C) => a.name.localeCompare(b.name);
	const roots = visible.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(byName);
	// Every postable category under a parent, however deep, labelled by its path.
	const leavesUnder = (parentId: string, prefix = ""): CategoryOption[] =>
		[...(childrenOf.get(parentId) ?? [])]
			.sort(byName)
			.flatMap((c) => [
				...(c.id === opts.value && childrenOf.has(c.id)
					? [{ id: c.id, label: prefix + c.name }]
					: []),
				...(childrenOf.has(c.id)
					? leavesUnder(c.id, `${prefix}${c.name} / `)
					: [{ id: c.id, label: prefix + c.name }]),
			]);

	const all: CategoryGroup[] = [
		{
			key: "top",
			heading: null,
			options: roots.filter((c) => !childrenOf.has(c.id)).map((c) => ({ id: c.id, label: c.name })),
		},
		...roots
			.filter((p) => childrenOf.has(p.id))
			.map((p) => ({
				key: p.id,
				heading: p.name,
				options: [
					...(p.id === opts.value ? [{ id: p.id, label: p.name }] : []),
					...leavesUnder(p.id),
				],
			})),
	];

	const q = searchKey(opts.query);
	const matching = all
		.map((g) => ({
			...g,
			options: g.options.filter((o) => searchKey(`${g.heading ?? ""} ${o.label}`).includes(q)),
		}))
		.filter((g) => g.options.length > 0);
	if (q) return matching;

	const found = new Map(all.flatMap((g) => g.options.map((o) => [o.id, { o, g }] as const)));
	const recent = opts.recentIds
		.flatMap((id) => {
			const hit = found.get(id);
			if (!hit) return [];
			// "Presents: Vita" needs no "Presents" beside it.
			const heading = hit.g.heading;
			return [
				{ ...hit.o, hint: heading && !hit.o.label.startsWith(heading) ? heading : undefined },
			];
		})
		.slice(0, RECENT_MAX);
	return recent.length > 0
		? [{ key: "recent", heading: "Recent", options: recent }, ...matching]
		: matching;
}
