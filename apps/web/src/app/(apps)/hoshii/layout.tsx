import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getChromeData } from "@/features/hoshii/actions/data";
import { HoshiiChrome } from "@/features/hoshii/components/HoshiiChrome";
import { getCurrentWorkspace, requireModule } from "@/lib/session";

export default async function HoshiiLayout({ children }: { children: React.ReactNode }) {
	await requireModule("/hoshii");
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
