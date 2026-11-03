import { getStarted } from "@/features/home/lib/today";
import { ZoneView } from "@/features/zones/components/ZoneView";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { getZone, type ZoneId } from "@/lib/zones";

/** A zone's route: the workspace, the user's day and which apps are in use, then the view. */
export async function ZonePage({ zone }: { zone: ZoneId }) {
	const [workspace, today] = await Promise.all([getCurrentWorkspace(), getUserToday()]);
	if (!workspace) return null;
	const started = await getStarted(workspace);
	return <ZoneView zone={getZone(zone)} ws={workspace} today={today} started={started} />;
}
