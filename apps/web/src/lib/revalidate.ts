import { revalidatePath } from "next/cache";

/**
 * The shell's pages read every app: Today (`/`), Week and Goals. Any write an app makes that
 * one of them shows calls this beside its own revalidation, so none of them goes stale.
 */
export function revalidateShell() {
	revalidatePath("/");
	revalidatePath("/week");
	revalidatePath("/goals");
}
