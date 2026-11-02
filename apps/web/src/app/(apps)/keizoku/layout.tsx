import { redirect } from "next/navigation";
import { KeizokuNavTabs } from "@/features/keizoku/components/KeizokuNavTabs";
import { getCurrentWorkspace } from "@/lib/session";

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
