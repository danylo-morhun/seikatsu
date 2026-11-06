// Tool results as compact JSON: what an app returns, minus what costs tokens and says
// nothing (nulls, empty lists, blank strings, timestamps' seconds).

/** Internal or visual fields no answer needs. */
const OMIT = new Set([
	"workspaceId",
	"vehicleId",
	"position",
	"coverUrl",
	"coverBlob",
	"imageUrl",
	"photoUrl",
	"color",
]);

export function compact(value: unknown): unknown {
	if (value === null || value === undefined || value === "") return undefined;
	if (value instanceof Date) {
		const iso = value.toISOString();
		return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : `${iso.slice(0, 16)}Z`;
	}
	if (Array.isArray(value)) {
		const items = value.map(compact).filter((v) => v !== undefined);
		return items.length > 0 ? items : undefined;
	}
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([k]) => !OMIT.has(k))
			.map(([k, v]) => [k, compact(v)] as const)
			.filter(([, v]) => v !== undefined);
		return entries.length > 0 ? Object.fromEntries(entries) : undefined;
	}
	if (typeof value === "number" && !Number.isInteger(value)) return Math.round(value * 100) / 100;
	return value;
}

export function toText(value: unknown): string {
	if (typeof value === "string") return value;
	// An empty answer still says what kind of nothing it is.
	return JSON.stringify(compact(value) ?? (Array.isArray(value) ? [] : {}));
}

/** At most `limit` rows from `offset`, and how to ask for the rest. */
export function page<T>(rows: T[], offset: number, limit: number) {
	const slice = rows.slice(offset, offset + limit);
	const next = offset + limit < rows.length ? offset + limit : undefined;
	return { total: rows.length, rows: slice, ...(next !== undefined ? { nextOffset: next } : {}) };
}
