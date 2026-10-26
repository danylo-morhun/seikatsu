// One structured Gemini call (free tier). Server-only helper, not a "use server" module.

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class GeminiError extends Error {
	constructor(
		message: string,
		/** Over the free quota: try again on a later run. */
		readonly limited = false,
		/** Busy for a moment: worth asking again now. */
		readonly overloaded = false,
	) {
		super(message);
		this.name = "GeminiError";
	}
}

export function geminiConfigured(): boolean {
	return !!process.env.GEMINI_API_KEY;
}

/** Overloaded (500/503) answers are common on the free tier: wait and ask again. */
const RETRY_DELAYS = [2_000, 6_000];

/** Asks for JSON in `schema`'s shape and returns it parsed. Throws GeminiError. */
export async function askGemini(
	prompt: string,
	schema: Record<string, unknown>,
	timeoutMs = 20_000,
): Promise<unknown> {
	for (const delay of RETRY_DELAYS) {
		try {
			return await askOnce(prompt, schema, timeoutMs);
		} catch (err) {
			if (!(err instanceof GeminiError) || !err.overloaded) throw err;
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
	return askOnce(prompt, schema, timeoutMs);
}

async function askOnce(
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
			headers: { "Content-Type": "application/json", "X-goog-api-key": key },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: { responseMimeType: "application/json", responseSchema: schema },
			}),
		});
		if (!res.ok)
			throw new GeminiError(
				`Gemini answered ${res.status}`,
				res.status === 429,
				res.status === 500 || res.status === 503,
			);
		const json = await res.json();
		const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
		if (typeof raw !== "string") throw new GeminiError("Gemini returned no text");
		return JSON.parse(raw);
	} catch (err) {
		if (err instanceof GeminiError) throw err;
		if (err instanceof Error && err.name === "AbortError")
			throw new GeminiError("Gemini timed out");
		throw new GeminiError(err instanceof Error ? err.message : "Gemini failed");
	} finally {
		clearTimeout(timeout);
	}
}
