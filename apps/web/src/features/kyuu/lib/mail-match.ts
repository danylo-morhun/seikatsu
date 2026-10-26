// Which applications a mail could be about, before any AI reads it. Pure; the mail sync uses it
// to skip the inbox's noise and to keep Gemini's list of candidates short.

export interface MailMessage {
	/** Gmail's message id. */
	id: string;
	threadId: string;
	/** "Name <address>" as Gmail gives it. */
	from: string;
	subject: string;
	/** ISO instant. */
	date: string;
	/** The user's calendar day it arrived on. */
	day: string;
	body: string;
}

export interface MailCandidate {
	id: string;
	company: string;
	role: string;
	jobUrl: string | null;
}

/** Applicant-tracking systems and boards that write on a company's behalf. */
const HIRING_PLATFORMS = [
	"greenhouse.io",
	"greenhouse-mail.io",
	"lever.co",
	"workable.com",
	"workablemail.com",
	"ashbyhq.com",
	"recruitee.com",
	"smartrecruiters.com",
	"teamtailor.com",
	"teamtailor-mail.com",
	"bamboohr.com",
	"personio.de",
	"personio.com",
	"breezy.hr",
	"jobvite.com",
	"icims.com",
	"myworkday.com",
	"workday.com",
	"pinpointhq.com",
	"homerun.co",
	"join.com",
	"rippling.com",
	"comeet.co",
	"jazzhr.com",
	"applytojob.com",
	"hire.trakstar.com",
	"successfactors.com",
	"djinni.co",
	"dou.ua",
	"justjoin.it",
	"nofluffjobs.com",
	"linkedin.com",
	"cleverstaff.net",
	"peopleforce.io",
	"hurma.work",
];

/** Words a company name carries that don't tell one company from another. */
const LEGAL = new Set([
	"inc",
	"llc",
	"ltd",
	"limited",
	"gmbh",
	"ag",
	"sa",
	"bv",
	"nv",
	"oy",
	"ou",
	"as",
	"ab",
	"plc",
	"corp",
	"corporation",
	"co",
	"company",
	"group",
	"sp",
	"z",
	"o",
	"srl",
	"spa",
	"sro",
	"tov",
	"тов",
	"the",
]);

/** Lower case, no accents, words split on anything but letters and digits. */
function words(text: string): string[] {
	return text
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
}

/** The words that name a company: "Acme Software GmbH" → ["acme", "software"]. */
export function companyWords(company: string): string[] {
	return words(company).filter((w) => !LEGAL.has(w));
}

function domainOf(from: string): string {
	const address = from.match(/<([^>]+)>/)?.[1] ?? from;
	return address.split("@")[1]?.trim().toLowerCase() ?? "";
}

/** Sent through a hiring platform: the company may only be named in the text. */
export function fromHiringPlatform(from: string): boolean {
	const domain = domainOf(from);
	return HIRING_PLATFORMS.some((p) => domain === p || domain.endsWith(`.${p}`));
}

/** A company's own site, from its posting link (not a board's). */
function companyHost(jobUrl: string | null): string | null {
	if (!jobUrl) return null;
	try {
		const host = new URL(jobUrl).hostname.toLowerCase();
		if (HIRING_PLATFORMS.some((p) => host === p || host.endsWith(`.${p}`))) return null;
		// careers.acme.com → acme.com
		return host.split(".").slice(-2).join(".");
	} catch {
		return null;
	}
}

/** Whether `needle` (a run of words) appears in `hay` word for word. */
function containsRun(hay: string[], needle: string[]): boolean {
	if (needle.length === 0) return false;
	outer: for (let i = 0; i + needle.length <= hay.length; i++) {
		for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
		return true;
	}
	return false;
}

const BODY_CHARS = 4_000;

/**
 * The applications a mail names: by company name in the sender, subject or text, or by the
 * company's own mail domain. A name of under three letters can't tell, so it's never matched.
 */
export function mailCandidates<T extends MailCandidate>(mail: MailMessage, apps: T[]): T[] {
	const domain = domainOf(mail.from);
	const head = words(`${mail.from} ${mail.subject}`);
	const body = words(mail.body.slice(0, BODY_CHARS));
	const glued = domain.replace(/[^a-z0-9]/g, "");

	return apps.filter((app) => {
		const host = companyHost(app.jobUrl);
		if (host && (domain === host || domain.endsWith(`.${host}`))) return true;
		const name = companyWords(app.company);
		if (name.join("").length < 3) return false;
		if (containsRun(head, name) || containsRun(body, name)) return true;
		// "Acme Labs" mailing from acmelabs.io.
		return name.join("").length >= 5 && glued.includes(name.join(""));
	});
}

/** Gmail's link to the thread, in the account it came from. */
export function gmailLink(threadId: string, account: string | null): string {
	const user = account ? `?authuser=${encodeURIComponent(account)}` : "";
	return `https://mail.google.com/mail/${user}#all/${threadId}`;
}
