"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@seikatsu/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { kyuuFilterStatusValues } from "../lib/kyuu-schemas";
import { KyuuDateRangeFilter } from "./KyuuDateRangeFilter";
import { StageFilter, type StageKey } from "./StageFilter";
import { STATUS_CONFIG } from "./StatusBadge";

const FILTER_KEYS = ["status", "source", "stage", "from", "to", "q"] as const;

interface Props {
	sources: string[];
}

export function KyuuFilterBar({ sources }: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const urlQuery = searchParams.get("q") ?? "";
	const [localQuery, setLocalQuery] = useState(urlQuery);

	function setParam(key: string, value: string | null) {
		const params = new URLSearchParams(searchParams.toString());
		if (value === null) params.delete(key);
		else params.set(key, value);
		params.delete("page");
		router.push(`${pathname}?${params.toString()}`);
	}

	function submitSearch(value: string) {
		setParam("q", value.trim() || null);
	}

	useEffect(() => {
		setLocalQuery(urlQuery);
	}, [urlQuery]);

	useEffect(() => {
		if (localQuery.trim() === urlQuery) return;
		const timer = setTimeout(() => {
			submitSearch(localQuery);
		}, 350);
		return () => clearTimeout(timer);
	}, [localQuery, urlQuery]);

	const status = searchParams.get("status") ?? "all";
	const source = searchParams.get("source") ?? "all";
	const stages = (searchParams.get("stage")?.split(",").filter(Boolean) ?? []) as StageKey[];
	const hasFilters = FILTER_KEYS.some((k) => searchParams.get(k));

	function clearAll() {
		const params = new URLSearchParams(searchParams.toString());
		for (const k of [...FILTER_KEYS, "page"]) params.delete(k);
		setLocalQuery("");
		const qs = params.toString();
		router.push(qs ? `${pathname}?${qs}` : pathname);
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="relative w-full max-w-xs">
				<HugeiconsIcon
					icon={Search01Icon}
					className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					placeholder="Search company or role…"
					className="h-8 pl-8 text-sm"
					value={localQuery}
					onChange={(e) => setLocalQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") submitSearch(localQuery);
					}}
				/>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Select value={status} onValueChange={(v) => setParam("status", v === "all" ? null : v)}>
					<SelectTrigger className="h-8 w-40">
						<SelectValue placeholder="All statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						{kyuuFilterStatusValues.map((s) => (
							<SelectItem key={s} value={s}>
								{STATUS_CONFIG[s].label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{sources.length > 0 && (
					<Select value={source} onValueChange={(v) => setParam("source", v === "all" ? null : v)}>
						<SelectTrigger className="h-8 w-36">
							<SelectValue placeholder="All sources" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All sources</SelectItem>
							{sources.map((s) => (
								<SelectItem key={s} value={s}>
									{s}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				<StageFilter
					value={stages}
					onChange={(v) => setParam("stage", v.length > 0 ? v.join(",") : null)}
				/>

				<KyuuDateRangeFilter />

				{hasFilters && (
					<button
						type="button"
						onClick={clearAll}
						className="h-8 shrink-0 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
					>
						Clear all
					</button>
				)}
			</div>
		</div>
	);
}
