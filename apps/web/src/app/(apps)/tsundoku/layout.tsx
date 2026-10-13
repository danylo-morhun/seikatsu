import { TsundokuNavTabs } from "@/features/tsundoku/components/TsundokuNavTabs";
import { getCurrentWorkspace } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function TsundokuLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");

	return (
		<>
			{children}
			<TsundokuNavTabs />
		</>
	);
}
