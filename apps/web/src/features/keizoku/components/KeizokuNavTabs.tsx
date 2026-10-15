"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import { createHabit } from "@/features/keizoku/actions/habits";
import { HabitDialog } from "@/features/keizoku/components/HabitDialog";
import { NEW_HABIT_EVENT, requestNewHabit } from "@/features/keizoku/lib/events";
import { markFresh } from "@/features/keizoku/lib/habit-nav";
import type { HabitFormValues } from "@/features/keizoku/lib/keizoku-schemas";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Add01Icon,
	Archive01Icon,
	Calendar03Icon,
	CheckListIcon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
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
	// Grid column of the lit item (the add button holds column 2).
	const litColumn = isArchive ? 3 : isSettings ? 4 : isYear ? 1 : 0;

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

	const item = (href: string, label: string, icon: typeof Add01Icon, column: number) => {
		const active = litColumn === column;
		return (
			<Link
				href={href}
				prefetch
				aria-current={active ? "page" : undefined}
				className={cn(
					"group relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
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
	};

	return (
		<>
			<nav
				aria-label="Keizoku sections"
				className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				<div className="relative mx-3 mb-3 grid grid-cols-5 items-center rounded-2xl border border-rule bg-sidebar px-1 py-1.5">
					{/* One pill slides to the lit item, so the move reads as going somewhere. */}
					<span
						aria-hidden
						className="pointer-events-none absolute top-1.5 left-1 flex w-[calc((100%-0.5rem)/5)] justify-center transition-transform duration-300 ease-in-out motion-reduce:transition-none"
						style={{ transform: `translateX(${litColumn * 100}%)` }}
					>
						<span className="h-7 w-12 rounded-full bg-primary/15" />
					</span>
					{item("/keizoku", "Today", CheckListIcon, 0)}
					{item("/keizoku/year", "Year", Calendar03Icon, 1)}
					<div className="relative flex items-center justify-center">
						<Button
							size="icon"
							aria-label="New habit"
							className="h-11 w-11 rounded-full"
							onClick={requestNewHabit}
						>
							<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
						</Button>
					</div>
					{item("/keizoku/archive", "Archive", Archive01Icon, 3)}
					{item("/settings/keizoku", "Settings", Settings01Icon, 4)}
				</div>
			</nav>

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
