import { KeizokuNavTabs } from "@/features/keizoku/components/KeizokuNavTabs";
import { getCurrentWorkspace } from "@/lib/session";

// Keizoku's settings are a Keizoku tab on phones: keep its bottom navigation (and capture).
export default async function KeizokuSettingsLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	return (
		<>
			{children}
			{workspace && <KeizokuNavTabs />}
		</>
	);
}
