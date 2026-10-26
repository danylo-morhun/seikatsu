import { getChromeData } from "@/features/hoshii/actions/data";
import { HoshiiChrome } from "@/features/hoshii/components/HoshiiChrome";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { Suspense } from "react";

// Hoshii's settings are a Hoshii tab on phones: keep its bottom navigation (and capture).
export default async function HoshiiSettingsLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) return children;
	const chrome = await getChromeData(workspace, await getUserToday());
	return (
		<>
			{children}
			<Suspense>
				<HoshiiChrome chrome={chrome} />
			</Suspense>
		</>
	);
}
