import { getProjects } from "@/features/seiryu/actions/projects";
import { FocusView } from "@/features/seiryu/components/FocusView";
import { SeiryuWelcome } from "@/features/seiryu/components/SeiryuWelcome";
import { getFocus } from "@/features/seiryu/lib/focus-data";

export default async function SeiryuPage() {
	const [projects, focus] = await Promise.all([getProjects(), getFocus()]);
	if (projects.length === 0) return <SeiryuWelcome />;

	return <FocusView sections={focus.sections} today={focus.today} projectCount={projects.length} />;
}
