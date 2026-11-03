import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFrame } from "@/components/AppFrame";
import { WeekView } from "@/features/week/components/WeekView";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function WeekPage({
	searchParams,
}: {
	searchParams: Promise<{ w?: string }>;
}) {
	const session = await auth();
	if (!session) redirect("/");
	const [workspace, today, { w }] = await Promise.all([
		getCurrentWorkspace(),
		getUserToday(),
		searchParams,
	]);
	if (!workspace) redirect("/");
	// Any day of the week to show; this week when it's missing or malformed.
	const day = w && DAY.test(w) && !Number.isNaN(Date.parse(w)) ? w : today;
	return (
		<AppFrame>
			<WeekView ws={workspace} today={today} day={day} />
		</AppFrame>
	);
}
