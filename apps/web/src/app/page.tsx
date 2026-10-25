import { auth } from "@/auth";
import { AppFrame } from "@/components/AppFrame";
import { PageLoader } from "@/components/PageLoader";
import { SignInCard } from "@/features/auth/components/SignInCard";
import { TodayView } from "@/features/home/components/TodayView";
import { getToday } from "@/features/home/lib/today";
import { ForgetOfflinePages } from "@/features/pwa/components/ForgetOfflinePages";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { Suspense } from "react";

export default async function HomePage() {
	const session = await auth();

	if (!session) {
		return (
			<main className="flex min-h-screen items-center justify-center p-4">
				<SignInCard />
				<ForgetOfflinePages />
			</main>
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
	const data = await getToday(workspace, today);
	return <TodayView data={data} today={today} workspace={workspace} firstName={firstName} />;
}
