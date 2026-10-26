"use client";

import type { ProjectSummary } from "@/features/seiryu/components/ProjectDialog";
import { ProjectList } from "@/features/seiryu/components/ProjectList";
import { SeiryuNavTabs } from "@/features/seiryu/components/SeiryuNavTabs";
import { rememberAppEntry } from "@/lib/app-entry";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

type Project = ProjectSummary & { position: string };

interface Props {
	projects: Project[];
	cardCounts: Record<string, number>;
	children: React.ReactNode;
}

/** Projects on the left from 768px (a quiet list, no box); the board fills the rest. */
export function SeiryuLayout({ projects, cardCounts, children }: Props) {
	const pathname = usePathname();
	// /seiryu/<projectId>/... → second segment
	const activeProjectId = pathname.split("/")[2] || undefined;
	const activeProject = projects.find((p) => p.id === activeProjectId);

	useEffect(() => {
		if (activeProject) rememberAppEntry("/seiryu", `/seiryu/${activeProject.id}`);
	}, [activeProject]);

	return (
		<div className="flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] overflow-hidden md:h-[calc(100dvh-4.5rem)]">
			<aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-rule px-3 pt-5 pb-8 md:block [scrollbar-width:thin]">
				<ProjectList
					projects={projects}
					activeProjectId={activeProjectId}
					cardCounts={cardCounts}
				/>
			</aside>
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
			<SeiryuNavTabs projects={projects} cardCounts={cardCounts} />
		</div>
	);
}
