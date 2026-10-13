import { TsundokuNavTabs } from "@/features/tsundoku/components/TsundokuNavTabs";
import { getCurrentWorkspace } from "@/lib/session";

// Tsundoku's settings are a Tsundoku tab on phones: keep its bottom navigation (and capture).
export default async function TsundokuSettingsLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	return (
		<>
			{children}
			{workspace && <TsundokuNavTabs />}
		</>
	);
}
