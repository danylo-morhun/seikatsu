import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AppFrame } from "@/components/AppFrame";
import { PageLoader } from "@/components/PageLoader";
import { Landing } from "@/features/auth/components/Landing";
import { CalendarView } from "@/features/calendar/components/CalendarView";
import {
	anchorOf,
	CALENDAR_COOKIE,
	calendarViewOf,
	HOME_COOKIE,
	homeViewOf,
} from "@/features/calendar/lib/calendar";
import { TodayView } from "@/features/home/components/TodayView";
import { getStarted } from "@/features/home/lib/today";
import { ForgetOfflinePages } from "@/features/pwa/components/ForgetOfflinePages";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

type Search = { v?: string; d?: string };

export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
	const session = await auth();

	if (!session) {
		return (
			<>
				<Landing />
				<ForgetOfflinePages />
			</>
		);
	}

	return (
		<AppFrame>
			<Suspense fallback={<PageLoader />}>
				<Today firstName={session.user?.name?.split(" ")[0] ?? null} searchParams={searchParams} />
			</Suspense>
		</AppFrame>
	);
}

async function Today({
	firstName,
	searchParams,
}: {
	firstName: string | null;
	searchParams: Promise<Search>;
}) {
	const [workspace, today, search, jar] = await Promise.all([
		getCurrentWorkspace(),
		getUserToday(),
		searchParams,
		cookies(),
	]);
	if (!workspace) return null;
	// A new user sets up their apps first.
	if (!workspace.onboardedAt) redirect("/welcome");
	// The calendar or the widgets: the URL's choice, else the one last used on this device.
	const view = homeViewOf(search.v, jar.get(HOME_COOKIE)?.value);
	if (view !== "widgets")
		return (
			<CalendarView ws={workspace} today={today} view={view} anchor={anchorOf(search.d, today)} />
		);
	// Which apps are in use decides the tiles; each tile's figures then stream in on their own.
	const started = await getStarted(workspace);
	return (
		<TodayView
			ws={workspace}
			today={today}
			started={started}
			firstName={firstName}
			calendar={calendarViewOf(jar.get(CALENDAR_COOKIE)?.value)}
		/>
	);
}
