"use client";

import type { ProjectSummary } from "@/features/seiryu/components/ProjectDialog";
import { ProjectList } from "@/features/seiryu/components/ProjectList";
import { requestNewCard } from "@/features/seiryu/lib/events";
import { readAppEntry } from "@/lib/app-entry";
import {
	Add01Icon,
	Archive01Icon,
	Folder01Icon,
	KanbanIcon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Sheet, SheetContent, SheetDescription, SheetTitle, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
	projects: (ProjectSummary & { position: string })[];
	cardCounts: Record<string, number>;
}

/** Phones: Kuroji's floating pill — Board, Projects, add, Archive, Settings. */
export function SeiryuNavTabs({ projects, cardCounts }: Props) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
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

	// Grid column of the lit item (the add button holds column 2); -1 lights nothing.
	const litColumn = projectsOpen ? 1 : isArchive ? 3 : isSettings ? 4 : projectId ? 0 : -1;

	function handleAdd() {
		if (isBoard) requestNewCard();
		// Elsewhere the board opens capture once it's there.
		else router.push(`${boardHref}?new=1`);
	}

	const item = (label: string, icon: typeof KanbanIcon, active: boolean) => (
		<>
			<span className="flex h-7 w-12 items-center justify-center">
				<HugeiconsIcon icon={icon} className="h-5 w-5" />
			</span>
			<span className="max-w-full truncate px-0.5 text-[11px] font-medium leading-none">
				{label}
			</span>
			<span className="sr-only">{active ? " (current)" : ""}</span>
		</>
	);
	const itemClass = (active: boolean) =>
		cn(
			"group relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
			active ? "text-primary" : "text-muted-foreground active:text-foreground",
		);

	return (
		<>
			<nav
				aria-label="Seiryu sections"
				className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				<div className="relative mx-3 mb-3 grid grid-cols-5 items-center rounded-2xl border border-rule bg-sidebar px-1 py-1.5">
					{/* One pill slides to the lit item, so the move reads as going somewhere. */}
					{litColumn >= 0 && (
						<span
							aria-hidden
							className="pointer-events-none absolute top-1.5 left-1 flex w-[calc((100%-0.5rem)/5)] justify-center transition-transform duration-300 ease-in-out motion-reduce:transition-none"
							style={{ transform: `translateX(${litColumn * 100}%)` }}
						>
							<span className="h-7 w-12 rounded-full bg-primary/15" />
						</span>
					)}
					<Link
						href={boardHref}
						prefetch
						aria-current={litColumn === 0 ? "page" : undefined}
						className={itemClass(litColumn === 0)}
					>
						{item("Board", KanbanIcon, litColumn === 0)}
					</Link>
					<button
						type="button"
						aria-haspopup="dialog"
						onClick={() => setProjectsOpen(true)}
						className={itemClass(litColumn === 1)}
					>
						{item("Projects", Folder01Icon, litColumn === 1)}
					</button>
					<div className="relative flex items-center justify-center">
						<Button
							size="icon"
							aria-label="New card"
							className="h-11 w-11 rounded-full"
							disabled={projects.length === 0}
							onClick={handleAdd}
						>
							<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
						</Button>
					</div>
					<Link
						href="/settings/seiryu?section=archive"
						prefetch
						aria-current={litColumn === 3 ? "page" : undefined}
						className={itemClass(litColumn === 3)}
					>
						{item("Archive", Archive01Icon, litColumn === 3)}
					</Link>
					<Link
						href="/settings/seiryu"
						prefetch
						aria-current={litColumn === 4 ? "page" : undefined}
						className={itemClass(litColumn === 4)}
					>
						{item("Settings", Settings01Icon, litColumn === 4)}
					</Link>
				</div>
			</nav>

			<Sheet open={projectsOpen} onOpenChange={setProjectsOpen}>
				<SheetContent side="left" className="w-[85vw] p-4 pt-14 text-sm sm:max-w-sm">
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
