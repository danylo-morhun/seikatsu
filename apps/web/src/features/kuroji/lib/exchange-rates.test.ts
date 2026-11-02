import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// No real DB here: `stored` stands in for the `exchangeRates` table. Exact-date lookups
// (`select … limit`) and latest-on-or-before lookups (`selectDistinctOn … orderBy`) read it.
type Row = { from: string; to: string; date: string; rate: string };
const stored: Row[] = [];
const inserts: Row[] = [];
const afterTasks: (() => Promise<unknown>)[] = [];

vi.mock("@seikatsu/db", () => {
	const exact = { from: () => exact, where: () => exact, limit: async () => [] };
	const latest = {
		from: () => latest,
		where: () => latest,
		orderBy: async () => {
			const best = new Map<string, Row>();
			for (const r of stored) {
				const prev = best.get(r.from);
				if (!prev || r.date > prev.date) best.set(r.from, r);
			}
			return [...best.values()];
		},
	};
	return {
		db: {
			select: () => exact,
			selectDistinctOn: () => latest,
			insert: () => ({
				values: (v: { date: string; fromCurrency: string; toCurrency: string; rate: string }) => ({
					onConflictDoNothing: async () => {
						inserts.push({ from: v.fromCurrency, to: v.toCurrency, date: v.date, rate: v.rate });
					},
				}),
			}),
		},
		and: (...args: unknown[]) => args,
		eq: (...args: unknown[]) => args,
		lte: (...args: unknown[]) => args,
		desc: (...args: unknown[]) => args,
		inArray: (...args: unknown[]) => args,
		exchangeRates: {},
	};
});

vi.mock("next/server", () => ({
	after: (task: () => Promise<unknown>) => afterTasks.push(task),
}));

describe("getExchangeRate", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("routes UAH pairs to PrivatBank/NBU and never calls Frankfurter", async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes("frankfurter.dev")) {
				throw new Error("Frankfurter has no UAH — should not be called for this pair");
			}
			if (url.includes("privatbank.ua")) {
				return {
					ok: true,
					json: async () => ({
						exchangeRate: [{ currency: "USD", saleRateNB: 41.5, purchaseRateNB: 41.3 }],
					}),
				};
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const { getExchangeRate } = await import("./exchange-rates");
		const rate = await getExchangeRate("USD", "UAH", "2026-06-01");

		expect(rate).toBe(41.5);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toContain("privatbank.ua");
	});

	it("uses Frankfurter for non-UAH pairs", async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes("frankfurter.dev")) {
				return { ok: true, json: async () => ({ rates: { EUR: 0.92 } }) };
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const { getExchangeRate } = await import("./exchange-rates");
		const rate = await getExchangeRate("USD", "EUR", "2026-06-01");

		expect(rate).toBe(0.92);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toContain("frankfurter.dev");
	});

	it("falls back to the previous day when PrivatBank has no rates yet", async () => {
		fetchMock.mockImplementation(async (url: string) => {
			const rates = url.includes("date=25.10.2026")
				? []
				: [{ currency: "EUR", saleRateNB: 48.2, purchaseRateNB: 48.2 }];
			return { ok: true, json: async () => ({ exchangeRate: rates }) };
		});

		const { getExchangeRate } = await import("./exchange-rates");
		const rate = await getExchangeRate("EUR", "UAH", "2026-10-25");

		expect(rate).toBe(48.2);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[1][0]).toContain("date=24.10.2026");
	});
});

describe("getRates", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		stored.length = 0;
		inserts.length = 0;
		afterTasks.length = 0;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
		vi.resetModules();
	});

	it("uses the latest stored rate and fetches the day after the response", async () => {
		stored.push({ from: "USD", to: "PLN", date: "2026-10-30", rate: "3.9" });
		fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rates: { PLN: 3.95 } }) });

		const { getRates } = await import("./exchange-rates");
		const rates = await getRates(["USD", "PLN"], "PLN", "2026-11-02");

		expect(rates.get("USD")).toBe(3.9);
		expect(rates.get("PLN")).toBe(1);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(afterTasks).toHaveLength(1);

		await afterTasks[0]?.();
		expect(inserts).toEqual([{ from: "USD", to: "PLN", date: "2026-11-02", rate: "3.95" }]);
		// Now known for the day: no lookup, no new refresh.
		expect((await getRates(["USD"], "PLN", "2026-11-02")).get("USD")).toBe(3.95);
		expect(afterTasks).toHaveLength(1);
	});

	it("fetches inline only when the pair has no stored rate", async () => {
		fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rates: { PLN: 4.25 } }) });

		const { getRates } = await import("./exchange-rates");
		const rates = await getRates(["EUR"], "PLN", "2026-11-02");

		expect(rates.get("EUR")).toBe(4.25);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(afterTasks).toHaveLength(0);
	});

	it("remembers a failure for a while instead of retrying every render", async () => {
		vi.useFakeTimers();
		fetchMock.mockRejectedValue(new Error("down"));

		const { getRates } = await import("./exchange-rates");
		expect((await getRates(["EUR"], "PLN", "2026-11-02")).get("EUR")).toBeNull();
		expect((await getRates(["EUR"], "PLN", "2026-11-02")).get("EUR")).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(11 * 60 * 1000);
		await getRates(["EUR"], "PLN", "2026-11-02");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
