import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getExchangeRate always caches through the `exchangeRates` table. No real DB
// is available in this test, so the cache lookup/insert are stubbed out —
// only the currency-routing logic under test is exercised.
vi.mock("@seikatsu/db", () => {
	const selectChain = {
		from: () => selectChain,
		where: () => selectChain,
		limit: async () => [],
	};
	return {
		db: {
			select: () => selectChain,
			insert: () => ({ values: () => ({ onConflictDoNothing: async () => {} }) }),
		},
		and: (...args: unknown[]) => args,
		eq: (...args: unknown[]) => args,
		exchangeRates: {},
	};
});

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
			if (url.includes("frankfurter.app")) {
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
			if (url.includes("frankfurter.app")) {
				return { ok: true, json: async () => ({ rates: { EUR: 0.92 } }) };
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const { getExchangeRate } = await import("./exchange-rates");
		const rate = await getExchangeRate("USD", "EUR", "2026-06-01");

		expect(rate).toBe(0.92);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toContain("frankfurter.app");
	});
});
