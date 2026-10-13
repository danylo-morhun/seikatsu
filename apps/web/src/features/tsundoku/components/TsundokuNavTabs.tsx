"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import { AddBookDialog } from "@/features/tsundoku/components/AddBookDialog";
import type { BookStatus } from "@/features/tsundoku/lib/constants";
import { NEW_BOOK_EVENT, requestNewBook } from "@/features/tsundoku/lib/events";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Add01Icon,
	Book01Icon,
	Calendar03Icon,
	Layers01Icon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const ADD_AS: Record<string, BookStatus> = { reading: "reading", read: "read" };

/**
 * Tsundoku's chrome around every page of the app: the phone's bottom pill (Library, Pile, add,
 * Year, Settings), the Add Book capture it and the header open, and the app-wide keys.
 */
export function TsundokuNavTabs() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const [capture, setCapture] = useState({ open: false, instant: false });

	const segment = pathname === "/tsundoku" ? searchParams.get("s") : null;
	const isSettings = pathname.startsWith("/settings/tsundoku");
	const isYear = pathname === "/tsundoku/year";
	// Grid column of the lit item (the add button holds column 2); -1 lights nothing.
	const litColumn = isSettings ? 4 : isYear ? 3 : segment === "pile" ? 1 : 0;

	// N captures anywhere in the app; B and Y go to the library and the year, "," to settings.
	useEffect(() => {
		function go(href: string) {
			startNavigationProgress();
			router.push(href);
		}
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "n") setCapture({ open: true, instant: true });
			else if (k === "b") go("/tsundoku");
			else if (k === "y") go("/tsundoku/year");
			else if (k === ",") go("/settings/tsundoku");
			else return;
			e.preventDefault();
		}
		function onRequest() {
			setCapture({ open: true, instant: false });
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(NEW_BOOK_EVENT, onRequest);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(NEW_BOOK_EVENT, onRequest);
		};
	}, [router]);

	const item = (href: string, label: string, icon: typeof Book01Icon, column: number) => {
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
				aria-label="Tsundoku sections"
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
					{item("/tsundoku", "Library", Book01Icon, 0)}
					{item("/tsundoku?s=pile", "Pile", Layers01Icon, 1)}
					<div className="relative flex items-center justify-center">
						<Button
							size="icon"
							aria-label="Add book"
							className="h-11 w-11 rounded-full"
							onClick={requestNewBook}
						>
							<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
						</Button>
					</div>
					{item("/tsundoku/year", "Year", Calendar03Icon, 3)}
					{item("/settings/tsundoku", "Settings", Settings01Icon, 4)}
				</div>
			</nav>

			<AddBookDialog
				open={capture.open}
				instant={capture.instant}
				defaultStatus={(segment && ADD_AS[segment]) || "want"}
				onOpenChange={(open) => setCapture((c) => ({ ...c, open }))}
			/>
		</>
	);
}
