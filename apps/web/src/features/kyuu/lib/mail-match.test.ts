import { describe, expect, it } from "vitest";
import {
	type MailCandidate,
	type MailMessage,
	companyWords,
	fromHiringPlatform,
	mailCandidates,
} from "./mail-match";

const mail = (over: Partial<MailMessage>): MailMessage => ({
	id: "m1",
	threadId: "t1",
	from: "Someone <someone@example.com>",
	subject: "",
	date: "2026-10-20T10:00:00Z",
	day: "2026-10-20",
	body: "",
	...over,
});

const apps: MailCandidate[] = [
	{ id: "acme", company: "Acme Software GmbH", role: "Frontend Engineer", jobUrl: null },
	{
		id: "globex",
		company: "Globex",
		role: "React Developer",
		jobUrl: "https://careers.globex.com/jobs/1",
	},
	{ id: "short", company: "EY", role: "Developer", jobUrl: null },
	{ id: "zabka", company: "Żabka Polska sp. z o.o.", role: "Engineer", jobUrl: null },
	{ id: "board", company: "Initech", role: "Dev", jobUrl: "https://djinni.co/jobs/1" },
];

const ids = (m: MailMessage) => mailCandidates(m, apps).map((a) => a.id);

describe("companyWords", () => {
	it("drops legal forms and accents", () => {
		expect(companyWords("Acme Software GmbH")).toEqual(["acme", "software"]);
		expect(companyWords("Żabka Polska sp. z o.o.")).toEqual(["zabka", "polska"]);
	});
});

describe("mailCandidates", () => {
	it("finds the company named in the subject or text", () => {
		expect(ids(mail({ subject: "Your application to Acme Software" }))).toEqual(["acme"]);
		expect(ids(mail({ body: "Thank you for applying to Żabka Polska. Unfortunately…" }))).toEqual([
			"zabka",
		]);
	});

	it("needs the whole name, word for word", () => {
		expect(ids(mail({ subject: "Acme rockets newsletter" }))).toEqual([]);
		expect(ids(mail({ body: "globexchange rates" }))).toEqual([]);
	});

	it("knows the company's own domain from its posting", () => {
		expect(ids(mail({ from: "Talent <talent@globex.com>" }))).toEqual(["globex"]);
		expect(ids(mail({ from: "jobs@mail.globex.com" }))).toEqual(["globex"]);
	});

	it("doesn't take a board's domain for the company's", () => {
		expect(ids(mail({ from: "Djinni <no-reply@djinni.co>" }))).toEqual([]);
	});

	it("never matches names too short to tell", () => {
		expect(ids(mail({ subject: "EY interview" }))).toEqual([]);
	});

	it("matches a domain that glues the name together", () => {
		expect(ids(mail({ from: "hr@acmesoftware.io" }))).toEqual(["acme"]);
	});
});

describe("fromHiringPlatform", () => {
	it("knows ATS senders and their subdomains", () => {
		expect(fromHiringPlatform("Acme <no-reply@us.greenhouse-mail.io>")).toBe(true);
		expect(fromHiringPlatform("Acme <notifications@ashbyhq.com>")).toBe(true);
		expect(fromHiringPlatform("jobs@mail.workable.com")).toBe(true);
		expect(fromHiringPlatform("friend@gmail.com")).toBe(false);
	});
});
