import { getChromeData } from "@/features/aisha/actions/data";
import { AishaChrome } from "@/features/aisha/components/AishaChrome";
import { getCurrentWorkspace } from "@/lib/session";

// Aisha's settings are an Aisha tab on phones: keep its bottom navigation (and capture).
export default async function AishaSettingsLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) return children;
	const car = await getChromeData();
	return (
		<>
			{children}
			<AishaChrome car={car} />
		</>
	);
}
