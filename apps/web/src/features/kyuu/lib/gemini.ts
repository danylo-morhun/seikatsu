// One structured Gemini call (free tier) through the Interactions API. Server-only helper,
// not a "use server" module. generateContent no longer answers this key.

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

/**
 * Tried in order: the better model first, and the light one when it's busy, over quota or slow.
 * Flash is often "experiencing high demand" on the free tier; Flash-Lite answers in seconds.
 */
const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"] as const;

export class GeminiError extends Error {
	constructor(
		message: string,
		/** Over the free quota: try again on a later run. */
		readonly limited = false,
		/** Busy for a moment: worth asking again (or another model) now. */
		readonly overloaded = false,
	) {
		super(message);
		this.name = "GeminiError";
	}
}

export function geminiConfigured(): boolean {
	return !!process.env.GEMINI_API_KEY;
}

/** How long the better model gets before the light one is asked instead. */
const FIRST_TRY_MS = 15_000;
/** The last model gets a second chance after a pause. */
const RETRY_DELAY = 3_000;

/** Asks for JSON in `schema`'s shape (JSON Schema) and returns it parsed. Throws GeminiError. */
export async function askGemini(
	prompt: string,
	schema: Record<string, unknown>,
	timeoutMs = 20_000,
): Promise<unknown> {
	let last: GeminiError | null = null;
	for (const [i, model] of MODELS.entries()) {
		// Don't let a busy first model eat the time the light one needs.
		const wait = i < MODELS.length - 1 ? Math.min(timeoutMs, FIRST_TRY_MS) : timeoutMs;
		try {
			return await askOnce(model, prompt, schema, wait);
		} catch (err) {
			if (!(err instanceof GeminiError) || !(err.overloaded || err.limited)) throw err;
			last = err;
		}
	}
	if (last?.overloaded) {
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
		return askOnce(MODELS[MODELS.length - 1], prompt, schema, timeoutMs);
	}
	throw last ?? new GeminiError("Gemini failed");
}

type Step = { type?: string; content?: { type?: string; text?: string }[] };

/** The model's answer: the text of the model_output step (a thought step may come first). */
export function outputText(json: unknown): string | null {
	const steps = (json as { steps?: Step[] } | null)?.steps;
	if (!Array.isArray(steps)) return null;
	const output = steps.find((s) => s.type === "model_output");
	const text = output?.content?.find((c) => c.type === "text")?.text;
	return typeof text === "string" ? text : null;
}

async function askOnce(
	model: string,
	prompt: string,
	schema: Record<string, unknown>,
	timeoutMs: number,
): Promise<unknown> {
	const key = process.env.GEMINI_API_KEY;
	if (!key) throw new GeminiError("GEMINI_API_KEY is not set");

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(GEMINI_URL, {
			method: "POST",
			signal: controller.signal,
			headers: { "Content-Type": "application/json", "x-goog-api-key": key },
			body: JSON.stringify({
				model,
				input: prompt,
				response_format: { type: "text", mime_type: "application/json", schema },
			}),
		});
		if (!res.ok)
			throw new GeminiError(
				`${model} answered ${res.status}`,
				res.status === 429,
				res.status === 500 || res.status === 503,
			);
		const raw = outputText(await res.json());
		if (raw == null) throw new GeminiError(`${model} returned no text`);
		return JSON.parse(raw);
	} catch (err) {
		if (err instanceof GeminiError) throw err;
		// A slow model counts as a busy one: the next is asked.
		if (err instanceof Error && err.name === "AbortError")
			throw new GeminiError(`${model} timed out`, false, true);
		throw new GeminiError(err instanceof Error ? err.message : "Gemini failed");
	} finally {
		clearTimeout(timeout);
	}
}
