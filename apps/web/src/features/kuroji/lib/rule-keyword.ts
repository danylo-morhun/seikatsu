// A bank rule files every future import whose description contains its text. This picks
// that text from one description: the merchant, without store numbers, codes, legal forms
// or the city, and always a piece of the original so the rule matches it.

const LEGAL_FORMS = new Set([
	"sp.",
	"sp",
	"z",
	"o.o.",
	"o.o",
	"zoo",
	"s.a.",
	"sa",
	"sp.j.",
	"sp.k.",
	"s.c.",
	"ltd",
	"llc",
	"inc",
	"gmbh",
]);

function isNoise(word: string): boolean {
	return /\d/.test(word) || !/\p{L}/u.test(word) || LEGAL_FORMS.has(word.toLowerCase());
}

/** The merchant to build a rule on, e.g. "ROSSMANN" from "ROSSMANN 05 Kalisz — TRANSAKCJA KARTĄ". */
export function ruleKeyword(description: string | null): string | null {
	if (!description) return null;
	// Bank imports read "<counterparty> — <bank details>"; only the counterparty names anyone.
	const [party, details = ""] = description.split(" — ");
	let words = party.trim().split(/\s+/).filter(Boolean);
	// Card payments name "<merchant> <city>": drop the city.
	if (/kart/i.test(details) && words.length > 1) words = words.slice(0, -1);

	// Runs of consecutive meaningful words; "*", "," or ";" end a word and its run.
	const runs: string[][] = [[]];
	for (const word of words) {
		const head = word.split(/[*,;]/)[0];
		if (isNoise(head)) {
			runs.push([]);
			continue;
		}
		runs[runs.length - 1].push(head);
		if (head !== word) runs.push([]);
	}

	// At most two words from a run; the first with some substance wins, else the longest.
	const candidates = runs.map((r) => r.slice(0, 2).join(" ")).filter(Boolean);
	const pick =
		candidates.find((c) => c.length >= 4) ??
		candidates.reduce((a, b) => (b.length > a.length ? b : a), "");
	if (pick.length < 3) return null;
	// Odd spacing between the two words: one word still matches.
	return description.includes(pick) ? pick : pick.split(" ")[0];
}
