// The app's look: Liquid Glass (macOS/iOS 26) or Classic (the flat Urushi look before it).
// Chosen per device in Settings → Account and kept in a cookie, like the colour theme.

export type Design = "glass" | "classic";

export const DESIGN_COOKIE = "design";

export function parseDesign(value: string | undefined): Design {
	return value === "classic" ? "classic" : "glass";
}

/**
 * Runs before paint (root layout) so `data-design` is on <html> for the first frame and for
 * portaled layers; CSS keys the `classic:` variant off it.
 */
export const DESIGN_SCRIPT = `document.documentElement.dataset.design=/(?:^|; )${DESIGN_COOKIE}=classic(?:;|$)/.test(document.cookie)?"classic":"glass"`;
