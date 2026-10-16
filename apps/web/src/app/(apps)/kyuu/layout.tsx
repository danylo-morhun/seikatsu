import { getResumeFiles, getSources } from "@/features/kyuu/actions/applications";
import { KyuuChrome } from "@/features/kyuu/components/KyuuChrome";
import { getCurrentWorkspace } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function KyuuLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const [sources, resumeFiles] = await Promise.all([getSources(), getResumeFiles()]);

	return (
		<>
			{children}
			<KyuuChrome sources={sources.map((s) => s.source)} resumeFiles={resumeFiles} />
		</>
	);
}
