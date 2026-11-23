import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AppFrame } from "@/components/AppFrame";
import { PageLoader } from "@/components/PageLoader";
import { Landing } from "@/features/auth/components/Landing";
import { TodayView } from "@/features/home/components/TodayView";
import { getStarted } from "@/features/home/lib/today";
import { ForgetOfflinePages } from "@/features/pwa/components/ForgetOfflinePages";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

export default async function HomePage() {
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
				<Today firstName={session.user?.name?.split(" ")[0] ?? null} />
			</Suspense>
		</AppFrame>
	);
}

async function Today({ firstName }: { firstName: string | null }) {
	const [workspace, today] = await Promise.all([getCurrentWorkspace(), getUserToday()]);
	if (!workspace) return null;
	// A new user sets up their apps first.
	if (!workspace.onboardedAt) redirect("/welcome");
	// Which apps are in use decides the tiles; each tile's figures then stream in on their own.
	const started = await getStarted(workspace);
	return <TodayView ws={workspace} today={today} started={started} firstName={firstName} />;
}
