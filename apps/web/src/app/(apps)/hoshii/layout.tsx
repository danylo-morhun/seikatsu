import { getChromeData } from "@/features/hoshii/actions/data";
import { HoshiiChrome } from "@/features/hoshii/components/HoshiiChrome";
import { getCurrentWorkspace } from "@/lib/session";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function HoshiiLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const chrome = await getChromeData(workspace);

	return (
		<>
			{children}
			<Suspense>
				<HoshiiChrome chrome={chrome} />
			</Suspense>
		</>
	);
}
