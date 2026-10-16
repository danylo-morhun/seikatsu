"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import { pageKey } from "@/lib/capture-shortcut";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@seikatsu/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CARRY_PARAMS } from "../lib/search-params";
import { KyuuDateRangeFilter } from "./KyuuDateRangeFilter";

/** Search, source, how it was sent, when: shared by All and Stats through the URL. */
export function KyuuFilters({ sources }: { sources: string[] }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const urlQuery = searchParams.get("q") ?? "";
	const [query, setQuery] = useState(urlQuery);
	const inputRef = useRef<HTMLInputElement>(null);
	// The q this input pushed last. When that push lands, the user may already have typed
	// more, so only a URL change from elsewhere (back, clear, link) resets the input.
	const pushed = useRef(urlQuery);

	function setParam(key: string, value: string | null) {
		const params = new URLSearchParams(searchParams.toString());
		if (value === null) params.delete(key);
		else params.set(key, value);
		params.delete("page");
		startNavigationProgress();
		router.push(`${pathname}?${params.toString()}`);
	}

	useEffect(() => {
		if (urlQuery === pushed.current) return;
		pushed.current = urlQuery;
		setQuery(urlQuery);
	}, [urlQuery]);

	useEffect(() => {
		if (query.trim() === urlQuery) return;
		const timer = setTimeout(() => {
			pushed.current = query.trim();
			setParam("q", query.trim() || null);
		}, 350);
		return () => clearTimeout(timer);
	}, [query, urlQuery]);

	// "/" jumps to the search.
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (pageKey(e) !== "/") return;
			e.preventDefault();
			inputRef.current?.focus();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const source = searchParams.get("source") ?? "all";
	const method = searchParams.get("method") ?? "all";
	const filtered = CARRY_PARAMS.some((k) => searchParams.get(k));

	function clearAll() {
		const params = new URLSearchParams(searchParams.toString());
		for (const k of [...CARRY_PARAMS, "page"]) params.delete(k);
		setQuery("");
		pushed.current = "";
		const qs = params.toString();
		startNavigationProgress();
		router.push(qs ? `${pathname}?${qs}` : pathname);
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="relative min-w-0 flex-1 basis-56 sm:max-w-xs">
				<HugeiconsIcon
					icon={Search01Icon}
					className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					ref={inputRef}
					type="search"
					aria-label="Search company or role"
					aria-keyshortcuts="/"
					placeholder="Company or role"
					className="pl-8"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Escape") e.currentTarget.blur();
					}}
				/>
			</div>

			{sources.length > 0 && (
				<Select value={source} onValueChange={(v) => setParam("source", v === "all" ? null : v)}>
					<SelectTrigger aria-label="Source" className="w-36">
						{/* Named here too: the server renders no item to read the label from. */}
						<SelectValue>{source === "all" ? "Any source" : source}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Any source</SelectItem>
						{sources.map((s) => (
							<SelectItem key={s} value={s}>
								{s}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}

			<Select value={method} onValueChange={(v) => setParam("method", v === "all" ? null : v)}>
				<SelectTrigger aria-label="How it was sent" className="w-36">
					<SelectValue>
						{method === "auto"
							? "By the pipeline"
							: method === "manual"
								? "By hand"
								: "Sent any way"}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Sent any way</SelectItem>
					<SelectItem value="auto">By the pipeline</SelectItem>
					<SelectItem value="manual">By hand</SelectItem>
				</SelectContent>
			</Select>

			<KyuuDateRangeFilter />

			{filtered && (
				<button
					type="button"
					onClick={clearAll}
					className="h-9 shrink-0 rounded-md px-2.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				>
					Clear
				</button>
			)}
		</div>
	);
}
