// Where a calendar row comes from, as it's drawn: an app's theme, kanji and name, or the user's
// own events (予, a plan, in the shell's pigment).

import type { Source } from "@/features/calendar/lib/events";
import { APPS_CONFIG } from "@/lib/app-themes";

const OWN = { theme: "", kanji: "予", name: "Event" };

export const sourceOf = (app: Source): { theme: string; kanji: string; name: string } =>
	app === "/calendar" ? OWN : APPS_CONFIG[app];
