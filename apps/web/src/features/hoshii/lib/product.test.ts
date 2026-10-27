import { describe, expect, it } from "vitest";
import { linksText, parsePrice, parseProductPage, shopOf } from "./product";

const URL = "https://www.x-kom.pl/p/123-sluchawki";

describe("parsePrice", () => {
	it.each([
		["1299", 1299],
		["1 299,00 zł", 1299],
		["1,299.00", 1299],
		["1.299,99", 1299.99],
		["12,99", 12.99],
		["1,299", 1299],
		["1.299", 1299],
		["849.00", 849],
		[189, 189],
	])("%s → %s", (raw, value) => expect(parsePrice(raw)).toBe(value));

	it("is null without a number", () => {
		expect(parsePrice("")).toBeNull();
		expect(parsePrice("free")).toBeNull();
		expect(parsePrice(undefined)).toBeNull();
		expect(parsePrice(-5)).toBeNull();
	});
});

describe("parseProductPage", () => {
	it("reads a JSON-LD Product inside @graph, with an offer list", () => {
		const html = `<html><head>
			<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
				{"@type":"BreadcrumbList"},
				{"@type":"Product","name":"Sennheiser Momentum 4 &amp; case","image":["/img/m4.jpg"],
				 "offers":[{"@type":"Offer","price":"1099.00","priceCurrency":"PLN"}]}
			]}</script>
			<meta property="og:title" content="Something else">
		</head></html>`;
		expect(parseProductPage(html, URL)).toEqual({
			title: "Sennheiser Momentum 4 & case",
			imageUrl: "https://www.x-kom.pl/img/m4.jpg",
			price: 1099,
			currency: "PLN",
		});
	});

	it("reads an AggregateOffer's low price and an image object", () => {
		const html = `<script type="application/ld+json">[{"@type":["Product"],"name":"Lamp",
			"image":{"url":"https://cdn.shop/lamp.webp"},
			"offers":{"@type":"AggregateOffer","lowPrice":749,"priceCurrency":"pln"}}]</script>`;
		expect(parseProductPage(html, URL)).toMatchObject({
			title: "Lamp",
			imageUrl: "https://cdn.shop/lamp.webp",
			price: 749,
			currency: "PLN",
		});
	});

	it("falls back to OpenGraph and product meta tags", () => {
		const html = `<head>
			<meta content="Salomon XT-6" property="og:title" />
			<meta property='og:image' content='//cdn.salomon.com/xt6.jpg'>
			<meta property="product:price:amount" content="189,00">
			<meta property="product:price:currency" content="EUR">
			<title>Ignored</title></head>`;
		expect(parseProductPage(html, "https://salomon.com/xt6")).toEqual({
			title: "Salomon XT-6",
			imageUrl: "https://cdn.salomon.com/xt6.jpg",
			price: 189,
			currency: "EUR",
		});
	});

	it("skips broken JSON-LD and uses the <title> as the last resort", () => {
		const html = `<script type="application/ld+json">{not json</script>
			<title>
				Kindle Colorsoft | Amazon
			</title>`;
		expect(parseProductPage(html, URL)).toEqual({
			title: "Kindle Colorsoft | Amazon",
			imageUrl: null,
			price: null,
			currency: null,
		});
	});

	it("never offers a non-web image link", () => {
		const html = `<meta property="og:image" content="javascript:alert(1)">`;
		expect(parseProductPage(html, URL).imageUrl).toBeNull();
	});
});

describe("shopOf", () => {
	it("is the bare host", () => {
		expect(shopOf(URL)).toBe("x-kom.pl");
		expect(shopOf("not a url")).toBeNull();
		expect(shopOf(null)).toBeNull();
	});
});

describe("linksText", () => {
	it("is the shop for one link, the count for more, null for none", () => {
		expect(linksText([])).toBeNull();
		expect(linksText([{ url: URL }])).toBe("x-kom.pl");
		expect(linksText([{ url: URL }, { url: "https://allegro.pl/x" }])).toBe("2 options");
	});
});
