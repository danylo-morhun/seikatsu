"use client";

import { GlassTabBar } from "@/components/GlassTabBar";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { createHabit } from "@/features/keizoku/actions/habits";
import { HabitDialog } from "@/features/keizoku/components/HabitDialog";
import { NEW_HABIT_EVENT } from "@/features/keizoku/lib/events";
import { markFresh } from "@/features/keizoku/lib/habit-nav";
import type { HabitFormValues } from "@/features/keizoku/lib/keizoku-schemas";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Archive01Icon,
	Calendar03Icon,
	CheckListIcon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Keizoku's chrome around every page of the app: the phone's bottom pill (Today, Year, add,
 * Archive, Settings), the New Habit capture it and the header open, and the app-wide keys.
 */
export function KeizokuNavTabs() {
	const pathname = usePathname();
	const router = useRouter();
	const [capture, setCapture] = useState({ open: false, instant: false });

	const isSettings = pathname.startsWith("/settings/keizoku");
	const isArchive = pathname === "/keizoku/archive";
	const isYear = pathname === "/keizoku/year";
	const lit = isArchive ? 2 : isSettings ? 3 : isYear ? 1 : 0;

	// N captures anywhere in the app; T and Y go to today and the year, "," to settings.
	useEffect(() => {
		function go(href: string) {
			startNavigationProgress();
			router.push(href);
		}
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "n") setCapture({ open: true, instant: true });
			else if (k === "t") go("/keizoku");
			else if (k === "y") go("/keizoku/year");
			else if (k === ",") go("/settings/keizoku");
			else return;
			e.preventDefault();
		}
		function onRequest() {
			setCapture({ open: true, instant: false });
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(NEW_HABIT_EVENT, onRequest);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(NEW_HABIT_EVENT, onRequest);
		};
	}, [router]);

	async function save(values: HabitFormValues) {
		const result = await createHabit(values).catch(() => ({
			error: "Couldn't save. Check your connection.",
		}));
		if ("error" in result) return result.error;
		markFresh(result.data.id);
		if (pathname !== "/keizoku") {
			toast.success(`“${result.data.name}” added`, {
				action: { label: "Today", onClick: () => router.push("/keizoku") },
			});
		}
		return undefined;
	}

	return (
		<>
			<GlassTabBar
				label="Keizoku sections"
				active={lit}
				items={[
					{ label: "Today", icon: CheckListIcon, href: "/keizoku" },
					{ label: "Year", icon: Calendar03Icon, href: "/keizoku/year" },
					{ label: "Archive", icon: Archive01Icon, href: "/keizoku/archive" },
					{ label: "Settings", icon: Settings01Icon, href: "/settings/keizoku" },
				]}
			/>

			<HabitDialog
				habit={null}
				open={capture.open}
				instant={capture.instant}
				onOpenChange={(open) => setCapture((c) => ({ ...c, open }))}
				onSave={(values) => save(values as HabitFormValues)}
			/>
		</>
	);
}
