"use client";

import { Spinner } from "@/components/Spinner";
import { searchBooks } from "@/features/tsundoku/actions/search";
import type { BookSearchResult } from "@/features/tsundoku/lib/book-search";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@seikatsu/ui";
import { useEffect, useRef, useState } from "react";

interface Props {
	onPick: (result: BookSearchResult) => void;
	pendingKey?: string | null;
}

export function BookSearchPanel({ onPick, pendingKey }: Props) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<BookSearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [searched, setSearched] = useState(false);
	const reqId = useRef(0);

	useEffect(() => {
		const q = query.trim();
		if (q.length < 2) {
			setResults([]);
			setSearched(false);
			return;
		}
		const id = ++reqId.current;
		setLoading(true);
		setError(null);
		const t = setTimeout(async () => {
			const res = await searchBooks(q);
			if (id !== reqId.current) return; // stale
			setLoading(false);
			setSearched(true);
			if ("error" in res) {
				setError(res.error);
				setResults([]);
			} else {
				setResults(res.results);
			}
		}, 400);
		return () => clearTimeout(t);
	}, [query]);

	return (
		<div className="space-y-3">
			<div className="relative">
				<HugeiconsIcon
					icon={Search01Icon}
					className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					autoFocus
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search by title or author…"
					className="pl-9"
				/>
				{loading && (
					<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
						<Spinner />
					</span>
				)}
			</div>

			{error && <p className="text-sm text-destructive">{error}</p>}

			<div className="max-h-[50vh] space-y-1 overflow-y-auto">
				{results.map((r) => (
					<button
						key={`${r.source}:${r.externalId}`}
						type="button"
						onClick={() => onPick(r)}
						disabled={pendingKey != null}
						className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
					>
						<div className="flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
							{r.coverUrl ? (
								<img
									src={r.coverUrl}
									alt={r.title}
									loading="lazy"
									className="h-full w-full object-cover"
								/>
							) : (
								<span className="px-1 text-center text-[9px] text-muted-foreground">
									{r.title.slice(0, 24)}
								</span>
							)}
						</div>
						<div className="min-w-0 flex-1">
							<p className="line-clamp-1 text-sm font-medium">{r.title}</p>
							<p className="line-clamp-1 text-xs text-muted-foreground">
								{r.authors.join(", ") || "Unknown author"}
								{r.publishedYear ? ` · ${r.publishedYear}` : ""}
							</p>
							<p className="text-[11px] text-muted-foreground">
								{r.pageCount ? `${r.pageCount} pages · ` : ""}
								{r.source === "google" ? "Google Books" : "Open Library"}
							</p>
						</div>
						{pendingKey === r.externalId && <Spinner />}
					</button>
				))}
				{searched && !loading && results.length === 0 && !error && (
					<p className="py-6 text-center text-sm text-muted-foreground">
						No results — try the Manual tab.
					</p>
				)}
			</div>
		</div>
	);
}
