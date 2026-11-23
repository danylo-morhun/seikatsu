import { redirect } from "next/navigation";
import { KeizokuNavTabs } from "@/features/keizoku/components/KeizokuNavTabs";
import { getCurrentWorkspace, requireModule } from "@/lib/session";

export default async function KeizokuLayout({ children }: { children: React.ReactNode }) {
	await requireModule("/keizoku");
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");

	return (
		<>
			{children}
			<KeizokuNavTabs />
		</>
	);
}
