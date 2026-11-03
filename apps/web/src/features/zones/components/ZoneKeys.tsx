"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { readAppEntry } from "@/lib/app-entry";
import { pageKey } from "@/lib/capture-shortcut";

/** A zone page's keys: 1, 2, 3… open its apps in the order the sidebar lists them. */
export function ZoneKeys({ apps }: { apps: readonly string[] }) {
	const router = useRouter();
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const key = pageKey(e);
			const app = key && /^[1-9]$/.test(key) ? apps[Number(key) - 1] : undefined;
			if (!app) return;
			e.preventDefault();
			startNavigationProgress();
			router.push(readAppEntry(app) ?? app);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router, apps]);
	return null;
}
