import { describe, expect, it } from "vitest";
import { describeAction } from "./describe";

const options = {
	wallets: [{ id: "w", name: "Pekao", currency: "PLN" }],
	expenseCategories: [{ id: "c-fuel", name: "Transport / Fuel" }],
	incomeCategories: [],
	projects: [{ id: "p", name: "Home", columnId: "col" }],
	lists: [{ id: "l", name: "Gym" }],
};

describe("describeAction", () => {
	it("names an expense by amount, merchant and category", () => {
		const text = describeAction(
			{
				key: "a",
				kind: "expense",
				amount: 240,
				currency: "PLN",
				currencyNamed: true,
				categoryId: "c-fuel",
				walletId: "w",
				description: "Orlen",
				date: "2026-11-03",
			},
			options,
			"2026-11-03",
		);
		expect(text.app).toBe("/kuroji");
		expect(text.detail).toBe("Orlen · Transport / Fuel · today");
	});

	it("asks for what's missing", () => {
		expect(
			describeAction(
				{ key: "a", kind: "card", title: "Call", projectId: null, dueDate: null, priority: null },
				options,
			).detail,
		).toBe("pick a project");
	});

	it("says where a want goes and when a card is due", () => {
		const want = describeAction(
			{
				key: "a",
				kind: "want",
				title: "Creatine",
				price: null,
				currency: "PLN",
				listId: "l",
				note: "",
				now: true,
			},
			options,
		);
		expect(want.detail).toBe("Gym · straight to the Plan");
		const card = describeAction(
			{
				key: "a",
				kind: "card",
				title: "Call",
				projectId: "p",
				dueDate: "2026-11-04",
				priority: "high",
			},
			options,
			"2026-11-03",
		);
		expect(card.detail).toBe("Home · due Nov 4 · High");
	});

	it("counts pages read", () => {
		const text = describeAction(
			{
				key: "a",
				kind: "pages",
				bookId: "b",
				title: "1984",
				page: 52,
				from: 26,
				date: "2026-11-03",
			},
			options,
		);
		expect(text).toEqual({ app: "/tsundoku", title: "1984: page 52", detail: "+26 pages" });
	});
});
