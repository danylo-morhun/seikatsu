import { redirect } from "next/navigation";
import { SettingsPage, SettingsSection } from "@/components/SettingsSection";
import { ModulesForm } from "@/features/home/components/ModulesForm";
import { APPS_CONFIG } from "@/lib/app-themes";
import { FEATURES, isModule } from "@/lib/modules";
import { getCurrentWorkspace } from "@/lib/session";

export default async function AppsSettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ off?: string }>;
}) {
	const [workspace, { off }] = await Promise.all([getCurrentWorkspace(), searchParams]);
	if (!workspace) redirect("/");
	// Sent here from a page of a module that's off.
	const asked =
		off && isModule(off)
			? off in APPS_CONFIG
				? APPS_CONFIG[off as keyof typeof APPS_CONFIG].name
				: FEATURES[off as keyof typeof FEATURES].name
			: null;

	return (
		<SettingsPage title="Apps">
			{asked && (
				<p className="rounded-group bg-surface px-[var(--group-px)] py-3 text-sm">
					{asked} is off. Turn it on below to open it.
				</p>
			)}
			<SettingsSection
				title="Apps"
				description="Off hides an app everywhere: the menus, Today, Capture, notifications and Claude. Its data stays."
			>
				<ModulesForm off={workspace.modulesOff} group="apps" />
			</SettingsSection>
			<SettingsSection
				title="Rhythm"
				description="Ways to plan across the apps. Today's list and Capture are always there."
			>
				<ModulesForm off={workspace.modulesOff} group="features" />
			</SettingsSection>
		</SettingsPage>
	);
}
