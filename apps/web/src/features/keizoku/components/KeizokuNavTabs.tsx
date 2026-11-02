"use client";

import {
	Add01Icon,
	Archive01Icon,
	Calendar03Icon,
	CheckListIcon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { TabBar, TabBarAction } from "@/components/TabBar";
import { createHabit } from "@/features/keizoku/actions/habits";
import { NEW_HABIT_EVENT, requestNewHabit } from "@/features/keizoku/lib/events";
import { markFresh } from "@/features/keizoku/lib/habit-nav";
import type { HabitFormValues } from "@/features/keizoku/lib/keizoku-schemas";
import { useOpenedOnce } from "@/hooks/useOpenedOnce";
import { pageKey } from "@/lib/capture-shortcut";

// The form loads on first open; hovering the add button starts it early.
const loadHabitDialog = () =>
	import("@/features/keizoku/components/HabitDialog").then((m) => m.HabitDialog);
const HabitDialog = dynamic(loadHabitDialog, { ssr: false });

/**
 * Keizoku's chrome around every page of the app: the phone's bottom pill (Today, Year, add,
 * Archive, Settings), the New Habit capture it and the header open, and the app-wide keys.
 */
export function KeizokuNavTabs() {
	const pathname = usePathname();
	const router = useRouter();
	const [capture, setCapture] = useState({ open: false, instant: false });
	const mounted = useOpenedOnce(capture.open);

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
			<TabBar
				label="Keizoku sections"
				active={lit}
				items={[
					{ label: "Today", icon: CheckListIcon, href: "/keizoku" },
					{ label: "Year", icon: Calendar03Icon, href: "/keizoku/year" },
					{ label: "Archive", icon: Archive01Icon, href: "/keizoku/archive" },
					{ label: "Settings", icon: Settings01Icon, href: "/settings/keizoku" },
				]}
				action={
					<TabBarAction
						icon={Add01Icon}
						aria-label="New habit"
						onClick={requestNewHabit}
						onPointerEnter={loadHabitDialog}
						onFocus={loadHabitDialog}
					/>
				}
			/>

			{mounted && (
				<HabitDialog
					habit={null}
					open={capture.open}
					instant={capture.instant}
					onOpenChange={(open) => setCapture((c) => ({ ...c, open }))}
					onSave={(values) => save(values as HabitFormValues)}
				/>
			)}
		</>
	);
}
