"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import { type KurojiTab, buildTabHref } from "@/features/kuroji/lib/tabs";
import { pageKey } from "@/lib/capture-shortcut";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const TAB_KEYS: Record<string, KurojiTab> = {
	"1": "expense",
	"2": "accounts",
	"3": "transactions",
	"4": "plan",
};

const SEARCH_SELECTOR = 'input[aria-label="Search transactions"]';

/** Kuroji's keys besides N (the capture dialog owns that one): tabs, search, settings. */
export function KurojiShortcuts() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const paramsRef = useRef(searchParams);
	paramsRef.current = searchParams;

	useEffect(() => {
		function go(href: string) {
			startNavigationProgress();
			router.push(href);
		}
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			const tab = k ? TAB_KEYS[k] : undefined;
			if (tab) go(buildTabHref(tab, paramsRef.current.toString()));
			else if (k === ",") go("/settings/kuroji");
			else if (k === "/") {
				// On Transactions, into the search; elsewhere, to Transactions first.
				const search = document.querySelector<HTMLInputElement>(SEARCH_SELECTOR);
				if (search) search.focus();
				else go(buildTabHref("transactions", paramsRef.current.toString()));
			} else return;
			e.preventDefault();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router]);

	return null;
}
