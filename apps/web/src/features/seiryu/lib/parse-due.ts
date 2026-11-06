// A due day and time written into a card's title ("Call the garage tomorrow 15:00",
// "оплатить счёт в пятницу"): found, taken out of the title, and set on the card. Pure.
// English, Russian and Ukrainian. Bare numbers like "2.5" are left alone: too often a price.

import { addUnits } from "@/features/seiryu/lib/repeat";

export interface ParsedDue {
	title: string;
	dueDate: string;
	dueTime: string | null;
}

/** Whole words only, Cyrillic included (`\b` knows only Latin letters). */
const B = "(?<![\\p{L}\\d])";
const E = "(?![\\p{L}\\d])";
/** A preposition right before a day or time goes with it ("by Friday", "до пятницы", "о 15"). */
const PRE = `(?:(?:on|by|at|до|к|ко|в|во|у|на|о|об|@)\\s+)?`;

const WEEKDAYS: [number, string][] = [
	[1, "monday|понедельник\\p{L}*|понеділ\\p{L}*"],
	[2, "tues(?:day)?|вторник\\p{L}*|вівтор\\p{L}*"],
	[3, "wednesday|сред[уаы]|серед[уаи]"],
	[4, "thurs(?:day)?|четверг\\p{L}*|четвер\\p{L}*"],
	[5, "friday|пятниц\\p{L}*|п['ʼ’]?ятниц\\p{L}*"],
	[6, "saturday|суббот\\p{L}*|субот\\p{L}*"],
	[7, "sunday|воскресень\\p{L}*|неділ\\p{L}*"],
];

/** Short names ("sun", "пт") read as days only at the end or before a time: "sun cream" isn't. */
const WEEKDAYS_SHORT: [number, string][] = [
	[1, "mon|пн"],
	[2, "tue|вт"],
	[3, "wed|ср"],
	[4, "thu|чт"],
	[5, "fri|пт"],
	[6, "sat|сб"],
	[7, "sun|вс|нд"],
];

const MONTHS: [number, string][] = [
	[1, "jan(?:uary)?|январ\\p{L}*|січ\\p{L}*"],
	[2, "feb(?:ruary)?|феврал\\p{L}*|лют\\p{L}*"],
	[3, "mar(?:ch)?|март\\p{L}*|берез\\p{L}*"],
	[4, "apr(?:il)?|апрел\\p{L}*|квіт\\p{L}*"],
	[5, "may|ма[йяе]|трав\\p{L}*"],
	[6, "jun(?:e)?|июн\\p{L}*|черв\\p{L}*"],
	[7, "jul(?:y)?|июл\\p{L}*|лип\\p{L}*"],
	[8, "aug(?:ust)?|август\\p{L}*|серп\\p{L}*"],
	[9, "sep(?:t|tember)?|сентябр\\p{L}*|верес\\p{L}*"],
	[10, "oct(?:ober)?|октябр\\p{L}*|жовт\\p{L}*"],
	[11, "nov(?:ember)?|ноябр\\p{L}*|листопад\\p{L}*"],
	[12, "dec(?:ember)?|декабр\\p{L}*|груд\\p{L}*"],
];

const alt = (list: [number, string][]) => list.map(([, re]) => re).join("|");
const which = (list: [number, string][], word: string) =>
	list.find(([, re]) => new RegExp(`^(?:${re})$`, "iu").test(word))?.[0] ?? null;

const pad = (n: number) => String(n).padStart(2, "0");

function isoWeekday(day: string): number {
	const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
	return wd === 0 ? 7 : wd;
}

function validDate(y: number, m: number, d: number): string | null {
	const at = new Date(Date.UTC(y, m - 1, d));
	return at.getUTCMonth() === m - 1 && at.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** Each rule: a pattern and what it means, given today; null = not a date after all. */
type DayRule = [RegExp, (m: RegExpExecArray, today: string) => string | null];

const NUM = "(\\d{1,2})";
const UNIT_DAY = "days?|дн\\p{L}*|день";
const UNIT_WEEK = "weeks?|недел\\p{L}*|тижд\\p{L}*|тижн\\p{L}*";
const UNIT_MONTH = "months?|месяц\\p{L}*|місяц\\p{L}*";

function unitOf(word: string) {
	if (new RegExp(`^(?:${UNIT_WEEK})$`, "iu").test(word)) return "week" as const;
	if (new RegExp(`^(?:${UNIT_MONTH})$`, "iu").test(word)) return "month" as const;
	return "day" as const;
}

/** A month and day with no year: this year, or next once it has passed. */
function upcoming(today: string, month: number, day: number): string | null {
	const year = Number(today.slice(0, 4));
	const date = validDate(year, month, day);
	if (!date) return null;
	return date >= today ? date : validDate(year + 1, month, day);
}

/** The next one to come: never today (said on a Friday, "Friday" is a week away). */
function weekdayRule(names: [number, string][], after: string): DayRule {
	return [
		new RegExp(
			`${B}${PRE}(?:(?:next|this|следующ\\p{L}*|эт\\p{L}*|наступн\\p{L}*|ц\\p{L}*)\\s+)?(${alt(names)})${E}${after}`,
			"iu",
		),
		(m, t) => {
			const wd = which(names, m[1] ?? "");
			return wd ? addUnits(t, ((wd - isoWeekday(t) + 6) % 7) + 1, "day") : null;
		},
	];
}

const DAY_RULES: DayRule[] = [
	[
		new RegExp(`${B}${PRE}(day after tomorrow|послезавтра|післязавтра)${E}`, "iu"),
		(_, t) => addUnits(t, 2, "day"),
	],
	[new RegExp(`${B}${PRE}(today|сегодня|сьогодні)${E}`, "iu"), (_, t) => t],
	[new RegExp(`${B}${PRE}(tomorrow|tmrw?|завтра)${E}`, "iu"), (_, t) => addUnits(t, 1, "day")],
	[
		new RegExp(
			`${B}(?:next week|на следующей неделе|наступного тижня|на наступному тижні)${E}`,
			"iu",
		),
		(_, t) => addUnits(t, 8 - isoWeekday(t), "day"),
	],
	[
		new RegExp(
			`${B}(?:in|через)\\s+(?:(\\d{1,3})\\s+|an?\\s+)?(${UNIT_DAY}|${UNIT_WEEK}|${UNIT_MONTH})${E}`,
			"iu",
		),
		(m, t) => addUnits(t, Number(m[1] ?? 1), unitOf(m[2] ?? "")),
	],
	[
		new RegExp(`${B}(\\d{4})-(\\d{2})-(\\d{2})${E}`, "u"),
		(m) => validDate(Number(m[1]), Number(m[2]), Number(m[3])),
	],
	[
		new RegExp(`${B}${PRE}(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})${E}`, "u"),
		(m) => validDate(Number(m[3]), Number(m[2]), Number(m[1])),
	],
	[
		new RegExp(`${B}${PRE}${NUM}(?:st|nd|rd|th)?\\s+(${alt(MONTHS)})${E}`, "iu"),
		(m, t) => {
			const month = which(MONTHS, m[2] ?? "");
			return month ? upcoming(t, month, Number(m[1])) : null;
		},
	],
	[
		new RegExp(`${B}${PRE}(${alt(MONTHS)})\\s+${NUM}(?:st|nd|rd|th)?${E}`, "iu"),
		(m, t) => {
			const month = which(MONTHS, m[1] ?? "");
			return month ? upcoming(t, month, Number(m[2])) : null;
		},
	],
	weekdayRule(WEEKDAYS, ""),
	weekdayRule(WEEKDAYS_SHORT, `(?=\\s*$|\\s+(?:at\\s+|в\\s+|о\\s+|@\\s*)?\\d)`),
];

type TimeRule = [RegExp, (m: RegExpExecArray) => string | null];

const TIME_RULES: TimeRule[] = [
	[
		new RegExp(`${B}${PRE}([01]?\\d|2[0-3]):([0-5]\\d)${E}`, "u"),
		(m) => `${pad(Number(m[1]))}:${m[2]}`,
	],
	[
		new RegExp(`${B}${PRE}(1[0-2]|0?[1-9])(?::([0-5]\\d))?\\s?(am|pm)${E}`, "iu"),
		(m) => {
			const h = (Number(m[1]) % 12) + ((m[3] ?? "").toLowerCase() === "pm" ? 12 : 0);
			return `${pad(h)}:${m[2] ?? "00"}`;
		},
	],
];

/**
 * "at 9", "в 15", "о 18": an hour only beside a day or at the end — "в 2 магазина" is a count.
 */
const bareHour = (anywhere: boolean): TimeRule => [
	new RegExp(
		`${B}(?:at|в|во|о|об|@)\\s+([01]?\\d|2[0-3])(?:[.:]([0-5]\\d))?${E}${anywhere ? "" : "(?=\\s*$)"}`,
		"iu",
	),
	(m) => `${pad(Number(m[1]))}:${m[2] ?? "00"}`,
];

function take<T>(
	text: string,
	rules: [RegExp, (m: RegExpExecArray, today: string) => T | null][],
	today: string,
): { value: T; rest: string } | null {
	for (const [re, read] of rules) {
		const m = re.exec(text);
		if (!m) continue;
		const value = read(m, today);
		if (value == null) continue;
		return { value, rest: `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}` };
	}
	return null;
}

/** The title with its due day and time taken out, or null when it names none. */
export function parseDue(text: string, today: string): ParsedDue | null {
	const day = take(text, DAY_RULES, today);
	const time = take(day?.rest ?? text, [...TIME_RULES, bareHour(day != null)], today);
	if (!day && !time) return null;
	const title = (time?.rest ?? day?.rest ?? text)
		.replace(/\s{2,}/g, " ")
		.replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "")
		.trim();
	if (!title) return null;
	return { title, dueDate: day?.value ?? today, dueTime: time?.value ?? null };
}
