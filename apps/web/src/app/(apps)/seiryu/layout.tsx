import { redirect } from "next/navigation";
import { getOpenCardCounts, getProjects } from "@/features/seiryu/actions/projects";
import { SeiryuLayout } from "@/features/seiryu/components/SeiryuLayout";
import { getCurrentWorkspace, requireModule } from "@/lib/session";

export default async function SeiryuRootLayout({ children }: { children: React.ReactNode }) {
	await requireModule("/seiryu");
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");

	const [projects, cardCounts] = await Promise.all([getProjects(), getOpenCardCounts()]);

	return (
		<SeiryuLayout projects={projects} cardCounts={cardCounts}>
			{children}
		</SeiryuLayout>
	);
}
