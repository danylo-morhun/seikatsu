"use client";

import { PageLoader } from "@/components/PageLoader";
import { ProjectSidebar } from "@/features/seiryu/components/ProjectSidebar";
import { Sheet, SheetContent, SheetTrigger, Button } from "@seikatsu/ui";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Project = {
	id: string;
	name: string;
	color: string | null;
};

interface Props {
	projects: Project[];
	workspaceId: string;
	children: React.ReactNode;
}

export function TassoLayout({ projects, workspaceId, children }: Props) {
	const [isPending, startTransition] = useTransition();
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const pathname = usePathname();

	// /tasso/<projectId>/... → extract second segment
	const activeProjectId = pathname.split("/")[2] ?? undefined;
	const activeProject = projects.find((p) => p.id === activeProjectId);

	return (
		<div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
			<aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border overflow-y-auto">
				<ProjectSidebar
					projects={projects}
					workspaceId={workspaceId}
					activeProjectId={activeProjectId}
				/>
			</aside>

			<main className="flex flex-1 min-w-0 flex-col overflow-hidden relative">
				{/* Mobile project header */}
				<div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
					{activeProject && (
						<span
							className="h-2.5 w-2.5 shrink-0 rounded-full"
							style={{ backgroundColor: activeProject.color ?? "#6366f1" }}
						/>
					)}
					<span className="flex-1 truncate text-sm font-medium">
						{activeProject?.name ?? "Projects"}
					</span>
					<Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<HugeiconsIcon icon={Menu01Icon} className="h-4 w-4" />
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="w-64 p-0">
							<ProjectSidebar
								projects={projects}
								workspaceId={workspaceId}
								activeProjectId={activeProjectId}
								onProjectSelect={() => setMobileNavOpen(false)}
							/>
						</SheetContent>
					</Sheet>
				</div>

				{isPending && <PageLoader overlay />}
				{children}
			</main>
		</div>
	);
}
