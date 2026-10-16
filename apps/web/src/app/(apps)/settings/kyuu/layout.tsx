import { getResumeFiles, getSources } from "@/features/kyuu/actions/applications";
import { KyuuChrome } from "@/features/kyuu/components/KyuuChrome";
import { getCurrentWorkspace } from "@/lib/session";

// Kyuu's settings are a Kyuu tab on phones: keep its bottom navigation (and capture).
export default async function KyuuSettingsLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) return children;
	const [sources, resumeFiles] = await Promise.all([getSources(), getResumeFiles()]);
	return (
		<>
			{children}
			<KyuuChrome sources={sources.map((s) => s.source)} resumeFiles={resumeFiles} />
		</>
	);
}
