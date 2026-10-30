"use client";

import { GlassTabBar } from "@/components/GlassTabBar";
import type { ProjectSummary } from "@/features/seiryu/components/ProjectDialog";
import { ProjectList } from "@/features/seiryu/components/ProjectList";
import { readAppEntry } from "@/lib/app-entry";
import {
	Archive01Icon,
	Folder01Icon,
	KanbanIcon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@seikatsu/ui";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
	projects: (ProjectSummary & { position: string })[];
	cardCounts: Record<string, number>;
}

/** Phones: the glass tab bar — Board, Projects, add, Archive, Settings. */
export function SeiryuNavTabs({ projects, cardCounts }: Props) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [projectsOpen, setProjectsOpen] = useState(false);
	const [entry, setEntry] = useState<string | null>(null);
	useEffect(() => setEntry(readAppEntry("/seiryu")), []);

	const projectId = pathname.startsWith("/seiryu/") ? pathname.split("/")[2] : undefined;
	const isBoard = /^\/seiryu\/[^/]+$/.test(pathname);
	const isSettings = pathname.startsWith("/settings/seiryu");
	const isArchive = isSettings && searchParams.get("section") === "archive";
	const boardHref = projectId
		? `/seiryu/${projectId}`
		: (entry ?? (projects[0] ? `/seiryu/${projects[0].id}` : "/seiryu"));

	const lit = projectsOpen ? 1 : isArchive ? 2 : isSettings ? 3 : projectId ? 0 : -1;

	return (
		<>
			<GlassTabBar
				label="Seiryu sections"
				active={lit}
				items={[
					{ label: "Board", icon: KanbanIcon, href: boardHref },
					{
						label: "Projects",
						icon: Folder01Icon,
						onClick: () => setProjectsOpen(true),
						"aria-haspopup": "dialog",
					},
					{ label: "Archive", icon: Archive01Icon, href: "/settings/seiryu?section=archive" },
					{ label: "Settings", icon: Settings01Icon, href: "/settings/seiryu" },
				]}
			/>

			<Sheet open={projectsOpen} onOpenChange={setProjectsOpen}>
				<SheetContent
					side="left"
					className="p-4 pt-14 text-sm data-[side=left]:w-[85vw] data-[side=left]:sm:max-w-sm"
				>
					<SheetTitle className="sr-only">Projects</SheetTitle>
					<SheetDescription className="sr-only">Pick a project to open its board.</SheetDescription>
					<ProjectList
						projects={projects}
						activeProjectId={projectId}
						cardCounts={cardCounts}
						onNavigate={() => setProjectsOpen(false)}
					/>
				</SheetContent>
			</Sheet>
		</>
	);
}
