// Server-only: fetching a shop page or a product photo for the user. Public web only, 5 s,
// size-capped. Not a "use server" module — call it from server actions.

import { isIP } from "node:net";

const TIMEOUT_MS = 5000;
const PAGE_MAX = 2_000_000;
export const IMAGE_MAX = 5_000_000;

const HEADERS = {
	// Many shops answer bots with a challenge page; a browser's headers get the real one.
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
	"Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
};

function privateIp(host: string): boolean {
	const h = host.replace(/^\[|\]$/g, "");
	const version = isIP(h);
	if (version === 4) {
		const [a, b] = h.split(".").map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 100 && b >= 64 && b <= 127)
		);
	}
	if (version === 6) {
		const l = h.toLowerCase();
		return (
			l === "::1" ||
			l === "::" ||
			/^f[cd]/.test(l) ||
			/^fe[89ab]/.test(l) ||
			l.startsWith("::ffff:")
		);
	}
	return false;
}

/** An http(s) link to the public web, or null. Keeps fetches off the server's own network. */
export function publicUrl(raw: string): URL | null {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;
	const host = url.hostname.toLowerCase();
	if (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host.endsWith(".local") ||
		host.endsWith(".internal") ||
		privateIp(host)
	) {
		return null;
	}
	return url;
}

async function get(url: URL, accept: string): Promise<Response> {
	const response = await fetch(url, {
		headers: { ...HEADERS, Accept: accept },
		redirect: "follow",
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	// A redirect may not land somewhere private either.
	if (!publicUrl(response.url || url.href)) throw new Error("Redirected off the public web");
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response;
}

/** The body, at most `max` bytes: a page keeps its head, a photo that big fails. */
async function readCapped(response: Response, max: number, truncate: boolean) {
	if (!truncate && Number(response.headers.get("content-length")) > max) {
		throw new Error("Too large");
	}
	const reader = response.body?.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (reader) {
		const { done, value } = await reader.read();
		if (done) break;
		if (size + value.byteLength > max) {
			await reader.cancel();
			if (!truncate) throw new Error("Too large");
			chunks.push(value.subarray(0, max - size));
			size = max;
			break;
		}
		chunks.push(value);
		size += value.byteLength;
	}
	const out = new Uint8Array(size);
	let at = 0;
	for (const c of chunks) {
		out.set(c, at);
		at += c.byteLength;
	}
	return out;
}

/** A page's HTML (at most its first 2 MB) and where it ended up after redirects. */
export async function fetchPage(url: URL): Promise<{ html: string; finalUrl: string }> {
	const response = await get(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5");
	const type = response.headers.get("content-type") ?? "";
	if (type && !/html|xml/.test(type)) throw new Error("Not a web page");
	const bytes = await readCapped(response, PAGE_MAX, true);
	return { html: new TextDecoder().decode(bytes), finalUrl: response.url || url.href };
}

const IMAGE_TYPES: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
};

/** A photo, at most 5 MB, as bytes with its type and extension. */
export async function fetchImage(url: URL) {
	const response = await get(url, "image/avif,image/webp,image/*;q=0.8");
	const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
	const ext = IMAGE_TYPES[type];
	if (!ext) throw new Error("Not a photo");
	const bytes = await readCapped(response, IMAGE_MAX, false);
	return { bytes, type, ext };
}
