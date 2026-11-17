// Sorting typed into a card's title: "BW: final price list #promo !4" goes into the group
// BW, wears the label promo and is urgent; the title keeps only "final price list". Only
// names that already exist in the project are read — anything else stays in the title.

import type { Priority } from "@/features/seiryu/lib/constants";

type Named = { id: string; name: string };

export type ParsedTitle = {
	title: string;
	groupId: string | null;
	labelIds: string[];
	priority: Priority | null;
};

/** Case and spaces don't matter: #black-week finds "Black Week". */
const key = (name: string) =>
	name
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, "");

const PRIORITY_WORDS: Record<string, Priority> = {
	"1": "low",
	"2": "medium",
	"3": "high",
	"4": "urgent",
	low: "low",
	medium: "medium",
	high: "high",
	urgent: "urgent",
};

/** The groups, labels and priority named in `text`, and the title without them. */
export function parseTitle(
	text: string,
	{ groups, labels }: { groups: Named[]; labels: Named[] },
): ParsedTitle {
	const find = (list: Named[], name: string) => list.find((n) => key(n.name) === key(name));
	let rest = text.trim();
	let groupId: string | null = null;
	const labelIds: string[] = [];
	let priority: Priority | null = null;

	// A leading "Name: " — the habit of writing the group in front of the title.
	const prefix = /^([^:\s][^:]{0,40}?):\s+(?=\S)/.exec(rest);
	if (prefix?.[1]) {
		const group = find(groups, prefix[1]);
		const label = group ? undefined : find(labels, prefix[1]);
		if (group) groupId = group.id;
		if (label) labelIds.push(label.id);
		if (group || label) rest = rest.slice(prefix[0].length);
	}

	const words = rest.split(/\s+/).filter((word) => {
		const tag = /^#([\p{L}\p{N}_-]+)$/u.exec(word)?.[1];
		if (tag) {
			const group = !groupId ? find(groups, tag) : undefined;
			if (group) {
				groupId = group.id;
				return false;
			}
			const label = find(labels, tag);
			if (label) {
				if (!labelIds.includes(label.id)) labelIds.push(label.id);
				return false;
			}
			return true;
		}
		const level = /^!(\w+)$/.exec(word)?.[1]?.toLowerCase();
		if (level && !priority && PRIORITY_WORDS[level]) {
			priority = PRIORITY_WORDS[level];
			return false;
		}
		return true;
	});

	const title = words.join(" ").trim();
	// Nothing left but the tags: keep the text as typed.
	if (!title) return { title: text.trim(), groupId: null, labelIds: [], priority: null };
	return { title, groupId, labelIds, priority };
}

/** Whether parsing found anything to sort (the dialog shows what it read). */
export const sortedSomething = (p: ParsedTitle) =>
	p.groupId !== null || p.labelIds.length > 0 || p.priority !== null;
