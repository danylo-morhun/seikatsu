import { PageTab, PageTabs } from "@/components/PageTabs";
import { SettingsPage, SettingsSection } from "@/components/SettingsSection";
import { getWorkspaceArchivedCards } from "@/features/seiryu/actions/cards";
import { getWorkspaceLabels } from "@/features/seiryu/actions/labels";
import { getOpenCardCounts, getProjects } from "@/features/seiryu/actions/projects";
import { SettingsArchive } from "@/features/seiryu/components/SettingsArchive";
import { SettingsLabels } from "@/features/seiryu/components/SettingsLabels";
import { NewProjectButton, SettingsProjects } from "@/features/seiryu/components/SettingsProjects";
import { toArchivedRows } from "@/features/seiryu/lib/archive";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserTimeZone, getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";

const SECTIONS = [
	{ id: "projects", label: "Projects" },
	{ id: "labels", label: "Labels" },
	{ id: "archive", label: "Archive" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export default async function SeiryuSettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ section?: string }>;
}) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");

	const { section: rawSection } = await searchParams;
	const section: SectionId = SECTIONS.some((s) => s.id === rawSection)
		? (rawSection as SectionId)
		: "projects";

	// Only what the open section shows is fetched.
	let body: React.ReactNode;
	if (section === "projects") {
		const [projects, counts] = await Promise.all([getProjects(), getOpenCardCounts()]);
		body = (
			<SettingsSection
				description="One board each. Drag them into order in the board's project list."
				action={<NewProjectButton count={projects.length} />}
			>
				<SettingsProjects
					projects={projects.map(({ id, name, color }) => ({
						id,
						name,
						color,
						openCards: counts[id] ?? 0,
					}))}
				/>
			</SettingsSection>
		);
	} else if (section === "labels") {
		const labels = await getWorkspaceLabels();
		body = (
			<SettingsSection description="Each project has its own. Rename, recolour or remove them here.">
				<SettingsLabels labels={labels} />
			</SettingsSection>
		);
	} else {
		const [cards, timeZone, today] = await Promise.all([
			getWorkspaceArchivedCards(),
			getUserTimeZone(),
			getUserToday(),
		]);
		body = (
			<SettingsSection description="Cards cleared off their boards. A restored card goes back to the end of its column.">
				<SettingsArchive today={today} cards={toArchivedRows(cards, timeZone)} />
			</SettingsSection>
		);
	}

	return (
		<SettingsPage
			title="清 Seiryu"
			appNav
			tabs={
				<PageTabs label="Seiryu settings">
					{SECTIONS.map((s) => (
						<PageTab
							key={s.id}
							href={s.id === "projects" ? "/settings/seiryu" : `/settings/seiryu?section=${s.id}`}
							current={section === s.id}
						>
							{s.label}
						</PageTab>
					))}
				</PageTabs>
			}
		>
			{body}
		</SettingsPage>
	);
}
