import { revalidatePath } from "next/cache";
import { pushToGoogleSoon } from "@/features/calendar/google/push";

/**
 * The shell's pages read every app: Today (`/`), Week and Goals. Any write an app makes that
 * one of them shows calls this beside its own revalidation, so none of them goes stale (and
 * the Google calendar, when connected, gets the change).
 */
export function revalidateShell() {
	revalidatePath("/");
	revalidatePath("/week");
	revalidatePath("/goals");
	// What changed may be on the user's Google calendar too.
	pushToGoogleSoon();
}
