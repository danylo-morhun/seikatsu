"use client";

import { GlassTabBar } from "@/components/GlassTabBar";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { AddBookDialog } from "@/features/tsundoku/components/AddBookDialog";
import type { BookStatus } from "@/features/tsundoku/lib/constants";
import { NEW_BOOK_EVENT } from "@/features/tsundoku/lib/events";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Book01Icon,
	Calendar03Icon,
	Layers01Icon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
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
	const lit = isSettings ? 3 : isYear ? 2 : segment === "pile" ? 1 : 0;

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

	return (
		<>
			<GlassTabBar
				label="Tsundoku sections"
				active={lit}
				items={[
					{ label: "Library", icon: Book01Icon, href: "/tsundoku" },
					{ label: "Pile", icon: Layers01Icon, href: "/tsundoku?s=pile" },
					{ label: "Year", icon: Calendar03Icon, href: "/tsundoku/year" },
					{ label: "Settings", icon: Settings01Icon, href: "/settings/tsundoku" },
				]}
			/>

			<AddBookDialog
				open={capture.open}
				instant={capture.instant}
				defaultStatus={(segment && ADD_AS[segment]) || "want"}
				onOpenChange={(open) => setCapture((c) => ({ ...c, open }))}
			/>
		</>
	);
}
