import { redirect } from "next/navigation";
import { TsundokuNavTabs } from "@/features/tsundoku/components/TsundokuNavTabs";
import { getCurrentWorkspace, requireModule } from "@/lib/session";

export default async function TsundokuLayout({ children }: { children: React.ReactNode }) {
	await requireModule("/tsundoku");
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");

	return (
		<>
			{children}
			<TsundokuNavTabs />
		</>
	);
}
