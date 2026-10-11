import { getProjects } from "@/features/seiryu/actions/projects";
import { SeiryuWelcome } from "@/features/seiryu/components/SeiryuWelcome";
import { redirect } from "next/navigation";

export default async function SeiryuPage() {
	const projects = await getProjects();
	const first = projects[0];

	if (first) redirect(`/seiryu/${first.id}`);

	return <SeiryuWelcome />;
}
