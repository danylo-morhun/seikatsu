"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Add01Icon,
	ChartLineData01Icon,
	Settings01Icon,
	TaskDone01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createApplication, deleteApplication } from "../actions/applications";
import {
	DELETE_APPLICATION_EVENT,
	type DeleteRequest,
	NEW_APPLICATION_EVENT,
	requestNewApplication,
} from "../lib/events";
import type { ResumeFile } from "../lib/types";
import { ApplicationDialog } from "./ApplicationDialog";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

/**
 * Kyuu's chrome around every page: the phone's bottom pill, the app-wide keys, the New
 * Application dialog and the delete confirmation that any page can ask for.
 */
export function KyuuChrome({
	sources,
	resumeFiles,
}: {
	sources: string[];
	resumeFiles: ResumeFile[];
}) {
	const pathname = usePathname();
	const router = useRouter();
	const [capture, setCapture] = useState({ open: false, instant: false });
	const [deleting, setDeleting] = useState<DeleteRequest | null>(null);

	useEffect(() => {
		function go(href: string) {
			startNavigationProgress();
			router.push(href);
		}
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "n") setCapture({ open: true, instant: true });
			else if (k === "1") go("/kyuu");
			else if (k === "2") go("/kyuu/stats");
			else if (k === ",") go("/settings/kyuu");
			else return;
			e.preventDefault();
		}
		const onNew = () => setCapture({ open: true, instant: false });
		const onDelete = (e: Event) => setDeleting((e as CustomEvent<DeleteRequest>).detail);
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(NEW_APPLICATION_EVENT, onNew);
		window.addEventListener(DELETE_APPLICATION_EVENT, onDelete);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(NEW_APPLICATION_EVENT, onNew);
			window.removeEventListener(DELETE_APPLICATION_EVENT, onDelete);
		};
	}, [router]);

	const isStats = pathname === "/kyuu/stats";
	const isSettings = pathname.startsWith("/settings/kyuu");
	const isTable = !isStats && !isSettings;
	// Grid column of the lit item (the add button holds column 1).
	const litColumn = isTable ? 0 : isStats ? 2 : 3;

	const nav = (href: string, label: string, icon: typeof Add01Icon, active: boolean) => (
		<Link
			href={href}
			prefetch
			aria-current={active ? "page" : undefined}
			className={cn(
				"relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
				active ? "text-primary" : "text-muted-foreground active:text-foreground",
			)}
		>
			<span className="flex h-7 w-12 items-center justify-center">
				<HugeiconsIcon icon={icon} className="h-5 w-5" />
			</span>
			<span className="max-w-full truncate px-0.5 text-[11px] font-medium leading-none">
				{label}
			</span>
		</Link>
	);

	return (
		<>
			<nav
				aria-label="Kyuu sections"
				className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				<div className="relative mx-3 mb-3 grid grid-cols-4 items-center rounded-2xl border border-rule bg-sidebar px-1 py-1.5">
					{/* One pill slides to the lit item, so the move reads as going somewhere. */}
					<span
						aria-hidden
						className="pointer-events-none absolute top-1.5 left-1 flex w-[calc((100%-0.5rem)/4)] justify-center transition-transform duration-300 ease-in-out motion-reduce:transition-none"
						style={{ transform: `translateX(${litColumn * 100}%)` }}
					>
						<span className="h-7 w-12 rounded-full bg-primary/15" />
					</span>
					{nav("/kyuu", "Applications", TaskDone01Icon, isTable)}
					<div className="flex items-center justify-center">
						<Button
							size="icon"
							aria-label="New application"
							className="h-11 w-11 rounded-full"
							onClick={requestNewApplication}
						>
							<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
						</Button>
					</div>
					{nav("/kyuu/stats", "Stats", ChartLineData01Icon, isStats)}
					{nav("/settings/kyuu", "Settings", Settings01Icon, isSettings)}
				</div>
			</nav>

			<ApplicationDialog
				open={capture.open}
				instant={capture.instant}
				onOpenChange={(v) => setCapture((c) => ({ ...c, open: v }))}
				sources={sources}
				resumeFiles={resumeFiles}
				onSave={async (values) => {
					const result = await createApplication(values).catch(() => FAILED);
					if ("error" in result) return result.error;
					toast.success(`“${values.company}” added`, {
						action: { label: "Open", onClick: () => router.push(`/kyuu/${result.data.id}`) },
					});
					return undefined;
				}}
			/>

			<ConfirmDelete
				open={deleting != null}
				onOpenChange={(v) => !v && setDeleting(null)}
				title={`Delete “${deleting?.company ?? ""}”?`}
				description="Its timeline and notes go with it. Archive it instead to keep them. This can't be undone."
				onConfirm={async () => {
					if (!deleting) return;
					const result = await deleteApplication(deleting.id).catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
					else if (deleting.afterwards) router.push(deleting.afterwards);
				}}
			/>
		</>
	);
}
