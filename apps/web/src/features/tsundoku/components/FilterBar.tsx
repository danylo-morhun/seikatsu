"use client";

import { PageLoader } from "@/components/PageLoader";
import type { TsundokuShelf } from "@/features/tsundoku/actions/shelves";
import { BOOK_STATUSES, STATUS_CONFIG } from "@/features/tsundoku/lib/constants";
import { GridViewIcon, ListViewIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	cn,
} from "@seikatsu/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const SORTS = [
	{ value: "added", label: "Recently added" },
	{ value: "title", label: "Title" },
	{ value: "author", label: "Author" },
	{ value: "rating", label: "Rating" },
	{ value: "finished", label: "Date finished" },
] as const;

interface Props {
	shelves: TsundokuShelf[];
	genres: string[];
}

export function FilterBar({ shelves, genres }: Props) {
	const params = useSearchParams();
	const pathname = usePathname();
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [q, setQ] = useState(params.get("q") ?? "");

	const view = params.get("view") === "list" ? "list" : "grid";
	const status = params.get("status") ?? "all";
	const shelf = params.get("shelf") ?? "all";
	const genre = params.get("genre") ?? "all";
	const sort = params.get("sort") ?? "added";

	function setParam(key: string, value: string, clearOnAll = true) {
		const next = new URLSearchParams(params.toString());
		if ((clearOnAll && value === "all") || value === "") next.delete(key);
		else next.set(key, value);
		startTransition(() => router.push(`${pathname}?${next.toString()}`));
	}

	// Debounced search → URL. Only `q` should re-trigger; params/setParam are stable enough here.
	useEffect(() => {
		const t = setTimeout(() => {
			if ((params.get("q") ?? "") !== q) setParam("q", q.trim());
		}, 400);
		return () => clearTimeout(t);
	}, [q]);

	return (
		<div className="space-y-3">
			{isPending && <PageLoader overlay />}
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-[200px] flex-1">
					<HugeiconsIcon
						icon={Search01Icon}
						className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search your library…"
						className="pl-9"
					/>
				</div>

				<Select value={status} onValueChange={(v) => setParam("status", v)}>
					<SelectTrigger className="w-[140px]">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						{BOOK_STATUSES.map((s) => (
							<SelectItem key={s} value={s}>
								{STATUS_CONFIG[s].label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{shelves.length > 0 && (
					<Select value={shelf} onValueChange={(v) => setParam("shelf", v)}>
						<SelectTrigger className="w-[140px]">
							<SelectValue placeholder="Shelf" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All shelves</SelectItem>
							{shelves.map((s) => (
								<SelectItem key={s.id} value={s.id}>
									{s.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				{genres.length > 0 && (
					<Select value={genre} onValueChange={(v) => setParam("genre", v)}>
						<SelectTrigger className="w-[140px]">
							<SelectValue placeholder="Genre" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All genres</SelectItem>
							{genres.map((g) => (
								<SelectItem key={g} value={g}>
									{g}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				<Select value={sort} onValueChange={(v) => setParam("sort", v, false)}>
					<SelectTrigger className="w-[150px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SORTS.map((s) => (
							<SelectItem key={s.value} value={s.value}>
								{s.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="flex overflow-hidden rounded-md border border-border">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => setParam("view", "grid")}
						className={cn("h-9 w-9 rounded-none", view === "grid" && "bg-accent text-primary")}
						aria-label="Grid view"
					>
						<HugeiconsIcon icon={GridViewIcon} className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => setParam("view", "list")}
						className={cn("h-9 w-9 rounded-none", view === "list" && "bg-accent text-primary")}
						aria-label="List view"
					>
						<HugeiconsIcon icon={ListViewIcon} className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
