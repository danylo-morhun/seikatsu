import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiError, askGemini, outputText } from "./gemini";

const answer = (value: unknown) => ({
	ok: true,
	status: 200,
	json: async () => ({
		steps: [
			{ type: "thought" },
			{ type: "model_output", content: [{ type: "text", text: JSON.stringify(value) }] },
		],
	}),
});
const failure = (status: number) => ({ ok: false, status, json: async () => ({}) });
const modelOf = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body).model;

describe("askGemini", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		process.env.GEMINI_API_KEY = "test-key";
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
		// biome-ignore lint/performance/noDelete: process.env assignment stringifies undefined, unlike a real delete
		delete process.env.GEMINI_API_KEY;
	});

	it("asks the Interactions API for JSON in the schema's shape", async () => {
		fetchMock.mockResolvedValue(answer({ country: "PL" }));
		await expect(askGemini("Where?", { type: "object" })).resolves.toEqual({ country: "PL" });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
		expect(JSON.parse(init.body)).toEqual({
			model: "gemini-3.8-flash",
			input: "Where?",
			response_format: { type: "text", mime_type: "application/json", schema: { type: "object" } },
		});
	});

	it("falls back to the light model when the first is busy or over quota", async () => {
		fetchMock.mockResolvedValueOnce(failure(503)).mockResolvedValueOnce(answer({ ok: 1 }));
		await expect(askGemini("x", {})).resolves.toEqual({ ok: 1 });
		fetchMock.mockResolvedValueOnce(failure(429)).mockResolvedValueOnce(answer({ ok: 2 }));
		await expect(askGemini("x", {})).resolves.toEqual({ ok: 2 });
		expect(fetchMock.mock.calls.map(modelOf)).toEqual([
			"gemini-3.8-flash",
			"gemini-3.5-flash-lite",
			"gemini-3.8-flash",
			"gemini-3.5-flash-lite",
		]);
	});

	it("doesn't fall back on a bad request", async () => {
		fetchMock.mockResolvedValue(failure(400));
		await expect(askGemini("x", {})).rejects.toBeInstanceOf(GeminiError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("tells a run to stop when every model is over quota", async () => {
		fetchMock.mockResolvedValue(failure(429));
		await expect(askGemini("x", {})).rejects.toMatchObject({ limited: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

describe("outputText", () => {
	it("reads the model_output step, past a thought", () => {
		expect(
			outputText({
				steps: [
					{ type: "thought" },
					{ type: "model_output", content: [{ type: "text", text: "{}" }] },
				],
			}),
		).toBe("{}");
		expect(outputText({ steps: [{ type: "thought" }] })).toBeNull();
		expect(outputText(null)).toBeNull();
	});
});
