import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
	auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

function geminiResponse(parsed: Record<string, unknown>) {
	return {
		ok: true,
		json: async () => ({
			candidates: [{ content: { parts: [{ text: JSON.stringify(parsed) }] } }],
		}),
	};
}

describe("extractApplicationFromText", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		process.env.GEMINI_API_KEY = "test-key";
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
		// biome-ignore lint/performance/noDelete: process.env assignment stringifies undefined, unlike a real delete
		delete process.env.GEMINI_API_KEY;
	});

	it("accepts a well-formed structured response without a real API call", async () => {
		fetchMock.mockResolvedValue(
			geminiResponse({
				company: "Acme Corp",
				role: "Senior Engineer",
				jobUrl: "https://example.com/job/1",
				source: "LinkedIn",
				notes: "Remote, TypeScript",
			}),
		);

		const { extractApplicationFromText } = await import("./extract");
		const result = await extractApplicationFromText("some job posting text");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			success: true,
			data: {
				company: "Acme Corp",
				role: "Senior Engineer",
				jobUrl: "https://example.com/job/1",
				source: "LinkedIn",
				notes: "Remote, TypeScript",
			},
		});
	});

	it("rejects a result with an empty company", async () => {
		fetchMock.mockResolvedValue(
			geminiResponse({ company: "", role: "Engineer", jobUrl: null, source: null, notes: null }),
		);

		const { extractApplicationFromText } = await import("./extract");
		const result = await extractApplicationFromText("some job posting text");

		expect(result).toEqual({ error: "Couldn't find a company and role in that text" });
	});

	it("rejects a result with an empty role", async () => {
		fetchMock.mockResolvedValue(
			geminiResponse({ company: "Acme Corp", role: "", jobUrl: null, source: null, notes: null }),
		);

		const { extractApplicationFromText } = await import("./extract");
		const result = await extractApplicationFromText("some job posting text");

		expect(result).toEqual({ error: "Couldn't find a company and role in that text" });
	});
});
