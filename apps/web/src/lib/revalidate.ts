import { revalidatePath } from "next/cache";
import { pushToGoogleSoon } from "@/features/calendar/google/push";

/**
 * The shell's pages read every app: Today (`/`), Week and Goals. Any write an app makes that
 * one of them shows calls this beside its own revalidation, so none of them goes stale (and
 * the Google calendar, when connected, gets the change).
 */
export function revalidateShell(
	/** Given by a write that seikatsu mirrors to Google (events, cards, booked calls): the
	 * change is sent there once the response is out. */
	workspaceId?: string,
) {
	revalidatePath("/");
	revalidatePath("/week");
	revalidatePath("/goals");
	if (workspaceId) pushToGoogleSoon(workspaceId);
}
