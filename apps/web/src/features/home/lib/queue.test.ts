import { describe, expect, it } from "vitest";
import { buildQueue, type QueueData } from "./queue";

const TODAY = "2026-11-03";

const empty: QueueData = { money: null, wants: null, cards: null, jobs: null, car: null };

const noJobs = { toSend: 0, followUps: [], calls: [], ghostIds: [], mailReview: 0 };
const noMoney = { captures: 0, uncategorized: 0, funds: [] };

const card = (id: string, dueDate: string, doneColumnId: string | null = "col-done") => ({
	id,
	title: `Card ${id}`,
	dueDate,
	projectId: "p",
	projectName: "Home",
	columnId: "col-todo",
	position: "a0",
	doneColumnId,
});

const wants = (n: number) => ({
	decide: n,
	toDecide: Array.from({ length: n }, (_, i) => ({ id: `w${i}`, title: `Want ${i}`, base: null })),
	currency: "PLN",
	canBuy: 0,
	nextBuy: null,
	plan: 0,
	cooling: 0,
	total: n,
});

describe("buildQueue", () => {
	it("is empty when nothing waits", () => {
		expect(buildQueue(empty, TODAY)).toEqual([]);
	});

	it("puts overdue first, then due, then the rest", () => {
		const queue = buildQueue(
			{
				...empty,
				cards: [card("today", TODAY), card("late", "2026-11-01")],
				jobs: { ...noJobs, ghostIds: ["a", "b"] },
				money: { ...noMoney, captures: 1 },
			},
			TODAY,
		);
		expect(queue.map((q) => q.key)).toEqual([
			"seiryu:late",
			"seiryu:today",
			"kuroji:captures",
			"kyuu:ghost",
		]);
		expect(queue[0].note).toBe("Home · 2 days overdue");
		expect(queue[3].act).toEqual({ kind: "ghost", ids: ["a", "b"] });
	});

	it("marks a card done only when its project has a finish column", () => {
		const [withDone, without] = buildQueue(
			{ ...empty, cards: [card("a", TODAY), card("b", TODAY, null)] },
			TODAY,
		);
		expect(withDone.act).toEqual({
			kind: "done",
			cardId: "a",
			columnId: "col-done",
			from: { columnId: "col-todo", position: "a0" },
		});
		expect(without.act).toEqual({ kind: "open" });
	});

	it("gives a few cooled wants a row each, and folds many into one", () => {
		expect(buildQueue({ ...empty, wants: wants(2) }, TODAY).map((q) => q.act.kind)).toEqual([
			"decide",
			"decide",
		]);
		const [many] = buildQueue({ ...empty, wants: wants(5) }, TODAY);
		expect(many).toMatchObject({ title: "5 wants to decide", act: { kind: "open" } });
	});

	it("lists every car item Aisha has as due, most urgent first", () => {
		const entry = (name: string, status: "soon" | "overdue", kmLeft: number) => ({
			name,
			status,
			kmLeft,
			daysLeft: null,
			when: null,
		});
		const car = {
			vehicleId: "v",
			name: "Hyundai i30",
			currentKm: 84_000,
			next: entry("Tyres", "overdue", -1200),
			due: [entry("Tyres", "overdue", -1200), entry("Oil", "soon", 600)],
		};
		expect(buildQueue({ ...empty, car: { ...car, due: [] } }, TODAY)).toEqual([]);
		const [late, soon] = buildQueue({ ...empty, car }, TODAY);
		expect(late).toMatchObject({ tone: "overdue", note: "Hyundai i30 · 1,200 km overdue" });
		expect(soon).toMatchObject({ tone: "due", note: "Hyundai i30 · in 600 km" });
	});

	it("brings Kyuu's calls, follow-ups and mail to check", () => {
		const queue = buildQueue(
			{
				...empty,
				jobs: {
					...noJobs,
					calls: [
						{ id: "c1", company: "Acme", kind: "interview", date: TODAY, time: "14:30" },
						{ id: "c2", company: "Initech", kind: "screening", date: "2026-11-04", time: null },
					],
					followUps: [{ id: "f1", company: "Globex" }],
					mailReview: 2,
				},
			},
			TODAY,
		);
		expect(queue.map((q) => q.title)).toEqual([
			"Interview · Acme",
			"2 answers from mail to check",
			"Follow up · Globex",
			"Screening · Initech",
		]);
		expect(queue[0].note).toBe("Today at 14:30");
		expect(queue[2].act).toEqual({ kind: "followUp", id: "f1", company: "Globex" });
	});

	it("asks for a fund's instalment and the bank's loose payments", () => {
		const fund = {
			id: "f",
			name: "Tatry",
			accountId: "acc",
			amount: 825,
			currency: "PLN",
			dueDate: "2027-02-01",
		};
		const queue = buildQueue(
			{ ...empty, money: { captures: 0, uncategorized: 3, funds: [fund] } },
			TODAY,
		);
		expect(queue.map((q) => q.title)).toEqual([
			"3 bank payments without a category",
			"Put 825 PLN into Tatry",
		]);
		expect(queue[1].act).toEqual({ kind: "fund", fund });
	});

	it("brings a goal that's behind or near its day, never as late work", () => {
		const queue = buildQueue(
			{
				...empty,
				goals: [
					{
						id: "g1",
						name: "Tatry",
						targetDate: "2026-11-20",
						startedOn: "2026-10-01",
						ratio: 0.9,
					},
					{
						id: "g2",
						name: "New job",
						targetDate: "2027-06-01",
						startedOn: "2026-06-01",
						ratio: 0.1,
					},
					{ id: "g3", name: "Calm", targetDate: "2027-06-01", startedOn: "2026-11-01", ratio: 0.1 },
				],
			},
			TODAY,
		);
		expect(queue.map((q) => [q.title, q.tone, q.note])).toEqual([
			["New job", "due", "Behind its pace · 10%"],
			["Tatry", "info", "Its day is close · 90%"],
		]);
	});
});
