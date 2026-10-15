import { KeizokuNavTabs } from "@/features/keizoku/components/KeizokuNavTabs";
import { getCurrentWorkspace } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function KeizokuLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");

	return (
		<>
			{children}
			<KeizokuNavTabs />
		</>
	);
}
