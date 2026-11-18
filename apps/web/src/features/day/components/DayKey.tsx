"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { pageKey } from "@/lib/capture-shortcut";

/** O on Today opens the part of the day that's due: the morning's plan or the evening's close. */
export function DayKey({ href }: { href: string }) {
	const router = useRouter();
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (pageKey(e) !== "o") return;
			e.preventDefault();
			startNavigationProgress();
			router.push(href);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router, href]);
	return null;
}
