"use client";

import {
	Add01Icon,
	Book01Icon,
	Calendar03Icon,
	Layers01Icon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { TabBar, TabBarAction } from "@/components/TabBar";
import type { BookStatus } from "@/features/tsundoku/lib/constants";
import { NEW_BOOK_EVENT, requestNewBook } from "@/features/tsundoku/lib/events";
import { useOpenedOnce } from "@/hooks/useOpenedOnce";
import { pageKey } from "@/lib/capture-shortcut";

// The search and form load on first open; hovering the add button starts it early.
const loadAddBook = () =>
	import("@/features/tsundoku/components/AddBookDialog").then((m) => m.AddBookDialog);
const AddBookDialog = dynamic(loadAddBook, { ssr: false });

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
	const mounted = useOpenedOnce(capture.open);

	const segment = pathname === "/tsundoku" ? searchParams.get("s") : null;
	const isSettings = pathname.startsWith("/settings/tsundoku");
	const isYear = pathname === "/tsundoku/year";
	const lit = isSettings ? 3 : isYear ? 2 : segment === "pile" ? 1 : 0;

	// N captures anywhere in the app; 1 and 2 go to the library and the year, "," to settings.
	// A digit over a book rates it instead: the book's own key runs first (it marks the event).
	useEffect(() => {
		function go(href: string) {
			startNavigationProgress();
			router.push(href);
		}
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "n") setCapture({ open: true, instant: true });
			else if (k === "1" || k === "2") {
				// Rating keys listen after this one: decide once they've had the event.
				queueMicrotask(() => {
					if (!e.defaultPrevented) go(k === "1" ? "/tsundoku" : "/tsundoku/year");
				});
				return;
			} else if (k === ",") go("/settings/tsundoku");
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
			<TabBar
				label="Tsundoku sections"
				active={lit}
				items={[
					{ label: "Library", icon: Book01Icon, href: "/tsundoku" },
					{ label: "Pile", icon: Layers01Icon, href: "/tsundoku?s=pile" },
					{ label: "Year", icon: Calendar03Icon, href: "/tsundoku/year" },
					{ label: "Settings", icon: Settings01Icon, href: "/settings/tsundoku" },
				]}
				action={
					<TabBarAction
						icon={Add01Icon}
						aria-label="Add book"
						onClick={requestNewBook}
						onPointerEnter={loadAddBook}
						onFocus={loadAddBook}
					/>
				}
			/>

			{mounted && (
				<AddBookDialog
					open={capture.open}
					instant={capture.instant}
					defaultStatus={(segment && ADD_AS[segment]) || "want"}
					onOpenChange={(open) => setCapture((c) => ({ ...c, open }))}
				/>
			)}
		</>
	);
}
