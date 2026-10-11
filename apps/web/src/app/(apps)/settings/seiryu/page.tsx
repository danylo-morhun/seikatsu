import { UnderlineTab, UnderlineTabs } from "@/components/UnderlineTabs";
import { getWorkspaceArchivedCards } from "@/features/seiryu/actions/cards";
import { getWorkspaceLabels } from "@/features/seiryu/actions/labels";
import { getOpenCardCounts, getProjects } from "@/features/seiryu/actions/projects";
import { SettingsArchive } from "@/features/seiryu/components/SettingsArchive";
import { SettingsLabels } from "@/features/seiryu/components/SettingsLabels";
import { NewProjectButton, SettingsProjects } from "@/features/seiryu/components/SettingsProjects";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserTimeZone, getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";

const SECTIONS = [
	{ id: "projects", label: "Projects" },
	{ id: "labels", label: "Labels" },
	{ id: "archive", label: "Archive" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

function SectionHeader({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="mb-4 flex items-start justify-between gap-4">
			<div className="min-w-0">
				<h2 className="text-sm font-medium">{title}</h2>
				<p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
			</div>
			{action}
		</div>
	);
}

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
			<section>
				<SectionHeader
					title="Projects"
					description="One board each. Reorder them by dragging in the board's project list."
					action={<NewProjectButton count={projects.length} />}
				/>
				<SettingsProjects
					projects={projects.map(({ id, name, color }) => ({
						id,
						name,
						color,
						openCards: counts[id] ?? 0,
					}))}
				/>
			</section>
		);
	} else if (section === "labels") {
		const labels = await getWorkspaceLabels();
		body = (
			<section>
				<SectionHeader
					title="Labels"
					description="Each project has its own. Rename, recolour or remove them here."
				/>
				<SettingsLabels labels={labels} />
			</section>
		);
	} else {
		const [cards, timeZone, today] = await Promise.all([
			getWorkspaceArchivedCards(),
			getUserTimeZone(),
			getUserToday(),
		]);
		const day = new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		body = (
			<section>
				<SectionHeader
					title="Archive"
					description="Cards cleared off their boards. Restore one to put it back at the end of its column."
				/>
				<SettingsArchive
					today={today}
					cards={cards.map(({ archivedAt, ...card }) => ({
						...card,
						archivedOn: archivedAt ? day.format(archivedAt) : null,
					}))}
				/>
			</section>
		);
	}

	return (
		<div className="max-w-3xl px-4 pt-6 pb-28 sm:px-8 md:pt-8 md:pb-8">
			<h1 className="text-xl font-semibold">清 Seiryu</h1>
			<div className="mt-4 mb-8">
				<UnderlineTabs label="Seiryu settings">
					{SECTIONS.map((s) => (
						<UnderlineTab
							key={s.id}
							href={s.id === "projects" ? "/settings/seiryu" : `/settings/seiryu?section=${s.id}`}
							current={section === s.id}
						>
							{s.label}
						</UnderlineTab>
					))}
				</UnderlineTabs>
			</div>
			{body}
		</div>
	);
}
