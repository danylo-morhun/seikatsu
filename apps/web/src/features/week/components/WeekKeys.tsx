"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { pageKey } from "@/lib/capture-shortcut";

/** [ and ] step a week back or ahead (as Kuroji's Plan steps months); T comes back to this one. */
export function WeekKeys({ prev, next }: { prev: string; next: string }) {
	const router = useRouter();
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			const href = k === "[" ? prev : k === "]" ? next : k === "t" ? "/week" : null;
			if (!href) return;
			e.preventDefault();
			startNavigationProgress();
			router.push(href);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router, prev, next]);
	return null;
}
