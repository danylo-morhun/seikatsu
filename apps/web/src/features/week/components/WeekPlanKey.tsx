"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { pageKey } from "@/lib/capture-shortcut";

/** O on Week opens the week's plan while it's due. */
export function WeekPlanKey() {
	const router = useRouter();
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (pageKey(e) !== "o") return;
			e.preventDefault();
			startNavigationProgress();
			router.push("/week/plan");
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router]);
	return null;
}
