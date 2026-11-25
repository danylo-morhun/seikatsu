// Where a calendar row comes from, as it's drawn: an app's theme, kanji and name, or the user's
// own events (予, a plan, in the shell's pigment), or a Google calendar (外, its colour).

import type { Source } from "@/features/calendar/lib/events";
import { APPS_CONFIG } from "@/lib/app-themes";

const OWN = { theme: "", kanji: "予", name: "Event" };
/** Google's: 外 (from outside), in each calendar's own colour. */
const GOOGLE = { theme: "", kanji: "外", name: "Google Calendar" };

export const sourceOf = (app: Source): { theme: string; kanji: string; name: string } =>
	app === "/calendar" ? OWN : app === "/google" ? GOOGLE : APPS_CONFIG[app];

/** A row's own colour (a Google calendar's) set as its pigment, for the classes to use. */
export const colorStyle = (color?: string) =>
	color ? ({ "--primary": color } as React.CSSProperties) : undefined;
