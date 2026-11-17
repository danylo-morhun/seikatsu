"use client";

import {
	Add01Icon,
	Folder01Icon,
	KanbanIcon,
	Settings01Icon,
	Target02Icon,
} from "@hugeicons/core-free-icons";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@seikatsu/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TabBar, TabBarAction } from "@/components/TabBar";
import { openCapture } from "@/features/capture/lib/key";
import type { ProjectSummary } from "@/features/seiryu/components/ProjectDialog";
import { ProjectList } from "@/features/seiryu/components/ProjectList";
import { requestNewCard } from "@/features/seiryu/lib/events";
import { readAppEntry } from "@/lib/app-entry";

interface Props {
	projects: (ProjectSummary & { position: string })[];
	cardCounts: Record<string, number>;
}

/** Phones: the glass tab bar — Focus, Board, add, Projects, Settings. */
export function SeiryuNavTabs({ projects, cardCounts }: Props) {
	const pathname = usePathname();
	const router = useRouter();
	const [projectsOpen, setProjectsOpen] = useState(false);
	const [entry, setEntry] = useState<string | null>(null);
	useEffect(() => setEntry(readAppEntry("/seiryu")), []);

	const projectId = pathname.startsWith("/seiryu/") ? pathname.split("/")[2] : undefined;
	const isBoard = /^\/seiryu\/[^/]+$/.test(pathname);
	const isSettings = pathname.startsWith("/settings/seiryu");
	const isFocus = pathname === "/seiryu";
	const boardHref = projectId
		? `/seiryu/${projectId}`
		: (entry ?? (projects[0] ? `/seiryu/${projects[0].id}` : "/seiryu"));

	const lit = projectsOpen ? 2 : isSettings ? 3 : isFocus ? 0 : projectId ? 1 : -1;

	function handleAdd() {
		if (isBoard) requestNewCard();
		// Focus spans every project: capture picks the place.
		else if (isFocus) openCapture();
		// Elsewhere the board opens capture once it's there.
		else router.push(`${boardHref}?new=1`);
	}

	return (
		<>
			<TabBar
				label="Seiryu sections"
				active={lit}
				items={[
					{ label: "Focus", icon: Target02Icon, href: "/seiryu" },
					{ label: "Board", icon: KanbanIcon, href: boardHref },
					{
						label: "Projects",
						icon: Folder01Icon,
						onClick: () => setProjectsOpen(true),
						"aria-haspopup": "dialog",
					},
					{ label: "Settings", icon: Settings01Icon, href: "/settings/seiryu" },
				]}
				action={
					<TabBarAction
						icon={Add01Icon}
						aria-label="New card"
						disabled={projects.length === 0}
						onClick={handleAdd}
					/>
				}
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
