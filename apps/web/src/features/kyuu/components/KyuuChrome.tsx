"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { GlassTabBar } from "@/components/GlassTabBar";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { pageKey } from "@/lib/capture-shortcut";
import { ChartLineData01Icon, Settings01Icon, TaskDone01Icon } from "@hugeicons/core-free-icons";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createApplication, deleteApplication } from "../actions/applications";
import { DELETE_APPLICATION_EVENT, type DeleteRequest, NEW_APPLICATION_EVENT } from "../lib/events";
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

	return (
		<>
			<GlassTabBar
				label="Kyuu sections"
				active={isTable ? 0 : isStats ? 1 : 2}
				items={[
					{ label: "Applications", icon: TaskDone01Icon, href: "/kyuu" },
					{ label: "Stats", icon: ChartLineData01Icon, href: "/kyuu/stats" },
					{ label: "Settings", icon: Settings01Icon, href: "/settings/kyuu" },
				]}
			/>

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
