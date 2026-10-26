// Reading a shop's product page: name, photo, price. JSON-LD Product first (most shops ship
// it), then OpenGraph / product meta tags, then microdata and <title>. Pure.

export type ProductInfo = {
	title: string | null;
	imageUrl: string | null;
	price: number | null;
	currency: string | null;
};

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

function decode(text: string): string {
	return text
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
			if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
			const n =
				code[1] === "x" || code[1] === "X"
					? Number.parseInt(code.slice(2), 16)
					: Number(code.slice(1));
			return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
		})
		.replace(/\s+/g, " ")
		.trim();
}

/** "1 299,00 zł", "1,299.00", "1299" → 1299. Null when there's no number. */
export function parsePrice(raw: unknown): number | null {
	if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : null;
	if (typeof raw !== "string") return null;
	let s = raw.replace(/[^\d.,]/g, "");
	if (!s) return null;
	const comma = s.lastIndexOf(",");
	const dot = s.lastIndexOf(".");
	if (comma > -1 && dot > -1) {
		// The later one is the decimal mark; the other groups thousands.
		s = comma > dot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
	} else if (comma > -1) {
		// "1,299" groups; "12,99" is a decimal.
		s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
	} else if (dot > -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
		s = s.replace(/\./g, "");
	}
	const n = Number(s);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

const CURRENCY_SIGNS: Record<string, string> = {
	zł: "PLN",
	"€": "EUR",
	$: "USD",
	"£": "GBP",
	"₴": "UAH",
	грн: "UAH",
};

function currencyOf(raw: unknown): string | null {
	if (typeof raw !== "string") return null;
	const code = raw.trim().toUpperCase();
	if (/^[A-Z]{3}$/.test(code)) return code;
	return CURRENCY_SIGNS[raw.trim().toLowerCase()] ?? null;
}

function absolute(url: unknown, base: string): string | null {
	if (typeof url !== "string" || !url.trim()) return null;
	try {
		const resolved = new URL(decode(url), base);
		return resolved.protocol === "https:" || resolved.protocol === "http:" ? resolved.href : null;
	} catch {
		return null;
	}
}

// ── JSON-LD ──

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);

function isProduct(node: Json): boolean {
	const type = node["@type"];
	const types = Array.isArray(type) ? type : [type];
	return types.some((t) => t === "Product" || t === "ProductGroup" || t === "IndividualProduct");
}

/** Every Product node, however deep (`@graph`, arrays, nested). */
function findProducts(node: unknown, out: Json[] = [], depth = 0): Json[] {
	if (depth > 8) return out;
	if (Array.isArray(node)) {
		for (const n of node) findProducts(n, out, depth + 1);
	} else if (isObject(node)) {
		if (isProduct(node)) out.push(node);
		for (const value of Object.values(node)) {
			if (typeof value === "object") findProducts(value, out, depth + 1);
		}
	}
	return out;
}

function firstImage(image: unknown): unknown {
	if (Array.isArray(image)) return firstImage(image[0]);
	if (isObject(image)) return image.url ?? image.contentUrl;
	return image;
}

function offerOf(offers: unknown): { price: number | null; currency: string | null } {
	const list = Array.isArray(offers) ? offers : [offers];
	for (const offer of list) {
		if (!isObject(offer)) continue;
		const spec = isObject(offer.priceSpecification) ? offer.priceSpecification : null;
		const price = parsePrice(offer.price ?? offer.lowPrice ?? spec?.price);
		if (price != null) {
			return { price, currency: currencyOf(offer.priceCurrency ?? spec?.priceCurrency) };
		}
		const nested = offerOf(offer.offers);
		if (nested.price != null) return nested;
	}
	return { price: null, currency: null };
}

function fromJsonLd(html: string, base: string): ProductInfo | null {
	const blocks = html.matchAll(
		/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi,
	);
	for (const [, body] of blocks) {
		let data: unknown;
		try {
			data = JSON.parse(body.trim());
		} catch {
			continue;
		}
		const product = findProducts(data)[0];
		if (!product) continue;
		const { price, currency } = offerOf(product.offers);
		return {
			title: typeof product.name === "string" ? decode(product.name) : null,
			imageUrl: absolute(firstImage(product.image), base),
			price,
			currency,
		};
	}
	return null;
}

// ── Meta tags ──

function metaTags(html: string): Map<string, string> {
	const tags = new Map<string, string>();
	for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
		const attrs = new Map<string, string>();
		for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
			attrs.set(m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? "");
		}
		const key = (
			attrs.get("property") ??
			attrs.get("name") ??
			attrs.get("itemprop")
		)?.toLowerCase();
		const value = attrs.get("content");
		if (key && value != null && !tags.has(key)) tags.set(key, value);
	}
	return tags;
}

function fromMeta(html: string, base: string): ProductInfo {
	const meta = metaTags(html);
	const pick = (...keys: string[]) => keys.map((k) => meta.get(k)).find((v) => v?.trim());
	const title =
		pick("og:title", "twitter:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
	return {
		title: title ? decode(title) : null,
		imageUrl: absolute(pick("og:image", "og:image:url", "twitter:image", "image"), base),
		price: parsePrice(pick("product:price:amount", "og:price:amount", "price")),
		currency: currencyOf(pick("product:price:currency", "og:price:currency", "pricecurrency")),
	};
}

/** What a product page says about itself. Missing fields are null; nothing throws. */
export function parseProductPage(html: string, pageUrl: string): ProductInfo {
	const ld = fromJsonLd(html, pageUrl);
	const meta = fromMeta(html, pageUrl);
	const price = ld?.price ?? meta.price;
	return {
		title: ld?.title || meta.title,
		imageUrl: ld?.imageUrl ?? meta.imageUrl,
		price,
		currency: price == null ? null : ((ld?.price != null ? ld.currency : meta.currency) ?? null),
	};
}

/** "https://www.x-kom.pl/p/…" → "x-kom.pl". */
export function shopOf(url: string | null): string | null {
	if (!url) return null;
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
}
