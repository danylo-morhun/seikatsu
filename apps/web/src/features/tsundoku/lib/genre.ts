// Search providers return free-form subjects ("Fiction, general", "Science fiction, American").
// The library filters on our short list, so a search result's subjects map onto it or nothing.

import type { Genre } from "./constants";

// Most specific first: "science fiction" must win over "fiction".
const RULES: [Genre, RegExp][] = [
	["Sci-fi", /science[ -]?fiction|sci-?fi|dystopi|space opera|cyberpunk/],
	["Fantasy", /fantasy|magic|dragons|wizards/],
	["Mystery", /mystery|detective|crime|whodunit/],
	["Thriller", /thriller|suspense|espionage|spy/],
	["Romance", /romance|love stories/],
	["Horror", /horror|ghost stories|supernatural/],
	["Comics", /comic|graphic novel|manga/],
	["Poetry", /poetry|poems/],
	["Biography", /biograph|memoir|autobiograph/],
	["History", /history|historical/],
	["Philosophy", /philosoph|ethics|stoic/],
	["Science", /science|physics|biology|mathematics|astronomy|chemistry/],
	["Self-help", /self-help|personal development|psychology|habits|productivity/],
	["Business", /business|economics|management|finance|entrepreneur|leadership/],
	["Fiction", /fiction|novel/],
];

export function genreFromSubjects(subjects: string[]): Genre | undefined {
	const text = subjects.join(" | ").toLowerCase();
	if (!text) return undefined;
	return RULES.find(([, re]) => re.test(text))?.[0];
}
