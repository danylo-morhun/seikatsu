import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@seikatsu/db", () => ({ db: {}, eq: vi.fn(), googleAccounts: {} }));
vi.mock("@/lib/seal", () => ({ seal: (v: string) => v, unseal: (v: string) => v }));

const { calendarApi } = await import("./api");

/** A fetch that hangs until aborted the first `hangs` times, then answers. */
function slowFetch(hangs: number) {
	let calls = 0;
	return vi.fn((_url: string, init: RequestInit) => {
		calls++;
		if (calls <= hangs)
			return new Promise<Response>((_, reject) => {
				init.signal?.addEventListener("abort", () =>
					reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" })),
				);
			});
		return Promise.resolve(Response.json({ items: [{ id: "c1" }] }));
	});
}

describe("Google calls that time out", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("asks a read once more", async () => {
		vi.useFakeTimers();
		const fetch = slowFetch(1);
		vi.stubGlobal("fetch", fetch);
		const list = calendarApi("t").calendars();
		await vi.advanceTimersByTimeAsync(15_000);
		await expect(list).resolves.toEqual([{ id: "c1" }]);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("gives up after the second, in words", async () => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", slowFetch(2));
		const list = calendarApi("t").calendars();
		const failed = expect(list).rejects.toMatchObject({
			status: 0,
			message: "Google didn't answer in 15 s",
		});
		await vi.advanceTimersByTimeAsync(30_000);
		await failed;
	});

	it("never repeats a write", async () => {
		vi.useFakeTimers();
		const fetch = slowFetch(1);
		vi.stubGlobal("fetch", fetch);
		const made = calendarApi("t").createCalendar("seikatsu", "UTC");
		const failed = expect(made).rejects.toMatchObject({ status: 0 });
		await vi.advanceTimersByTimeAsync(15_000);
		await failed;
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
