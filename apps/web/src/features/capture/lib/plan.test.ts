import { describe, expect, it } from "vitest";
import { buildPrompt, type CaptureContext, isReady, type RawAction, toPlan } from "./plan";

const actions = (answer: unknown, c: CaptureContext) => toPlan(answer, c).actions;

const ctx: CaptureContext = {
	today: "2026-11-03",
	baseCurrency: "PLN",
	wallets: [
		{ id: "w-pln", name: "Pekao", currency: "PLN" },
		{ id: "w-uah", name: "Privat", currency: "UAH" },
	],
	expenseCategories: [
		{ id: "c-fuel", name: "Transport / Fuel" },
		{ id: "c-food", name: "Groceries" },
	],
	incomeCategories: [{ id: "c-salary", name: "Salary" }],
	vehicle: { id: "v1", name: "Hyundai i30", currentKm: 84_210 },
	projects: [
		{ id: "p-home", name: "Home", columnId: "col-home" },
		{ id: "p-wb", name: "wellbotany.pl", columnId: "col-wb" },
	],
	habits: [{ id: "h-gym", name: "Gym", emoji: "💪" }],
	books: [{ id: "b-1984", title: "Nineteen Eighty-Four", currentPage: 26, pageCount: 318 }],
};

const raw = (fields: Partial<RawAction> & Pick<RawAction, "kind">): RawAction => ({
	amount: null,
	currency: null,
	categoryId: null,
	walletId: null,
	description: null,
	date: null,
	km: null,
	title: null,
	price: null,
	projectId: null,
	habitId: null,
	bookId: null,
	page: null,
	pagesRead: null,
	...fields,
});

describe("toPlan", () => {
	it("turns fuel with a reading into an expense and mileage", () => {
		const plan = actions(
			{
				actions: [
					raw({
						kind: "expense",
						amount: 240,
						currency: "PLN",
						categoryId: "c-fuel",
						description: "Orlen",
					}),
					raw({ kind: "mileage", km: 84_500 }),
				],
			},
			ctx,
		);
		expect(plan).toEqual([
			{
				key: "a0",
				kind: "expense",
				amount: 240,
				currency: "PLN",
				categoryId: "c-fuel",
				walletId: null,
				description: "Orlen",
				date: "2026-11-03",
			},
			{
				key: "a1",
				kind: "mileage",
				vehicleId: "v1",
				vehicleName: "Hyundai i30",
				km: 84_500,
				from: 84_210,
				date: "2026-11-03",
			},
		]);
		expect(isReady(plan[0])).toBe(false);
		expect(isReady(plan[1])).toBe(true);
	});

	it("never keeps an id the user doesn't own", () => {
		const [expense, card] = actions(
			{
				actions: [
					raw({ kind: "expense", amount: 10, categoryId: "someone-else", walletId: "w-x" }),
					raw({ kind: "card", title: "Call the garage", projectId: "nope" }),
					raw({ kind: "habit", habitId: "h-other" }),
				],
			},
			ctx,
		);
		expect(expense).toMatchObject({ categoryId: null, walletId: null, currency: "PLN" });
		expect(card).toMatchObject({ kind: "card", projectId: null });
	});

	it("takes the wallet's currency when none is named", () => {
		const [expense] = actions(
			{ actions: [raw({ kind: "expense", amount: 300, walletId: "w-uah" })] },
			ctx,
		);
		expect(expense).toMatchObject({ walletId: "w-uah", currency: "UAH" });
	});

	it("drops a reading below the odometer, and a future date becomes today", () => {
		const plan = actions(
			{
				actions: [
					raw({ kind: "mileage", km: 80_000 }),
					raw({ kind: "habit", habitId: "h-gym", date: "2026-12-01" }),
					raw({ kind: "habit", habitId: "h-gym", date: "2026-11-02" }),
				],
			},
			ctx,
		);
		expect(plan.map((a) => ("date" in a ? a.date : null))).toEqual(["2026-11-03", "2026-11-02"]);
	});

	it("counts pages read from where the book is, up to its last page", () => {
		const plan = actions(
			{
				actions: [
					raw({ kind: "pages", pagesRead: 20 }),
					raw({ kind: "pages", bookId: "b-1984", page: 500 }),
					raw({ kind: "pages", page: 10 }),
				],
			},
			ctx,
		);
		expect(plan).toEqual([
			{
				key: "a0",
				kind: "pages",
				bookId: "b-1984",
				title: "Nineteen Eighty-Four",
				page: 46,
				from: 26,
			},
			{
				key: "a1",
				kind: "pages",
				bookId: "b-1984",
				title: "Nineteen Eighty-Four",
				page: 318,
				from: 26,
			},
		]);
	});

	it("ignores an answer of the wrong shape", () => {
		expect(actions(null, ctx)).toEqual([]);
		expect(actions({ actions: "x" }, ctx)).toEqual([]);
		expect(
			actions({ actions: [{ kind: "delete everything" }, { kind: "want", title: "  " }] }, ctx),
		).toEqual([]);
	});

	it("keeps a want with its price in the main currency", () => {
		const [want] = actions({ actions: [raw({ kind: "want", title: "Kindle", price: 599 })] }, ctx);
		expect(want).toEqual({ key: "a0", kind: "want", title: "Kindle", price: 599, currency: "PLN" });
	});
});

describe("toPlan skipped", () => {
	it("says why it can't do something", () => {
		const { actions: kept, skipped } = toPlan(
			{
				actions: [
					raw({ kind: "mileage", km: 80_000 }),
					raw({ kind: "habit", habitId: "h-other" }),
					raw({ kind: "pages", page: 10 }),
					raw({ kind: "want", title: " " }),
				],
			},
			ctx,
		);
		expect(kept).toEqual([]);
		expect(skipped).toEqual([
			"Mileage 80\u00a0000 km: the odometer already reads 84\u00a0210 km.",
			"A habit that isn't in Keizoku: add it there first.",
			"Nineteen Eighty-Four: you're already on page 26.",
		]);
	});
});

describe("isReady", () => {
	it("waits for what an edit emptied", () => {
		const [expense, want, mileage] = actions(
			{
				actions: [
					raw({ kind: "expense", amount: 5, categoryId: "c-food", walletId: "w-pln" }),
					raw({ kind: "want", title: "Hat" }),
					raw({ kind: "mileage", km: 84_300 }),
				],
			},
			ctx,
		);
		expect([expense, want, mileage].map(isReady)).toEqual([true, true, true]);
		expect(isReady({ ...expense, amount: 0 } as typeof expense)).toBe(false);
		expect(isReady({ ...want, title: "  " } as typeof want)).toBe(false);
		expect(isReady({ ...mileage, km: 84_000 } as typeof mileage)).toBe(false);
	});
});

describe("buildPrompt", () => {
	it("lists the user's ids and quotes the line", () => {
		const prompt = buildPrompt('бенз 240 zł "Orlen"', ctx);
		expect(prompt).toContain("- c-fuel: Transport / Fuel");
		expect(prompt).toContain("Current reading 84210 km");
		expect(prompt).toContain('The line: "бенз 240 zł \\"Orlen\\""');
	});
});
