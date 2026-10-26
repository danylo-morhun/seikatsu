"use server";

import { fetchPage, publicUrl } from "@/features/hoshii/lib/fetch-web";
import { type ProductInfo, parseProductPage, shopOf } from "@/features/hoshii/lib/product";
import { getSessionUserId } from "@/lib/session";

export type LinkInfo = ProductInfo & { shop: string | null };

/** What a shop's page says about the product: name, photo, price. */
export async function readLink(
	link: string,
): Promise<{ error: string } | { success: true; data: LinkInfo }> {
	if (!(await getSessionUserId())) return { error: "Not signed in" };
	const url = publicUrl(link.trim());
	if (!url) return { error: "That isn't a web link." };
	try {
		const { html, finalUrl } = await fetchPage(url);
		return { success: true, data: { ...parseProductPage(html, finalUrl), shop: shopOf(finalUrl) } };
	} catch {
		return { error: `Couldn't read ${shopOf(url.href) ?? "the page"}.` };
	}
}
