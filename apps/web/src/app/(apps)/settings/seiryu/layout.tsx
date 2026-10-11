import { getOpenCardCounts, getProjects } from "@/features/seiryu/actions/projects";
import { SeiryuNavTabs } from "@/features/seiryu/components/SeiryuNavTabs";
import { getCurrentWorkspace } from "@/lib/session";

// Seiryu's settings are a Seiryu tab on phones: keep its bottom navigation here too.
export default async function SeiryuSettingsLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	const [projects, cardCounts] = workspace
		? await Promise.all([getProjects(), getOpenCardCounts()])
		: [[], {}];

	return (
		<>
			{children}
			{workspace && <SeiryuNavTabs projects={projects} cardCounts={cardCounts} />}
		</>
	);
}
