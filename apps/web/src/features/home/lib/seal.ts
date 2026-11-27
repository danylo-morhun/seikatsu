// The seal a row of the day's list wears: its app's kanji in its pigment, or the shell's own
// for goals (志), the user's events (予) and Google's (外, in its calendar's colour).

import { APPS_CONFIG } from "@/lib/app-themes";

const OWN: Record<string, string> = { "/goals": "志", "/calendar": "予", "/google": "外" };

/** `fallback`: the kanji for anything else (the user's own words on a plan). */
export function sealOf(app: string, fallback = "志"): { theme: string; kanji: string } {
	if (app in APPS_CONFIG) return APPS_CONFIG[app as keyof typeof APPS_CONFIG];
	return { theme: "", kanji: OWN[app] ?? fallback };
}
