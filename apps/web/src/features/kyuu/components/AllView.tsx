"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import { UnderlineTab, UnderlineTabs } from "@/components/UnderlineTabs";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { KyuuView } from "../lib/kyuu-schemas";
import type { SortField } from "../lib/search-params";
import type { ApplicationRow } from "../lib/types";
import { ApplicationArea } from "./ApplicationArea";
import { ApplicationRowItem, TABLE_GRID } from "./ApplicationRowItem";
import { KyuuFilters } from "./KyuuFilters";

const VIEWS: { value: KyuuView; label: string; empty: string }[] = [
	{ value: "all", label: "All", empty: "No applications yet." },
	{ value: "queue", label: "To send", empty: "Nothing to send." },
	{ value: "waiting", label: "Waiting", empty: "Nothing waiting for an answer." },
	{ value: "active", label: "In progress", empty: "Nothing in progress." },
	{ value: "closed", label: "Closed", empty: "Nothing closed." },
	{ value: "archived", label: "Archived", empty: "Nothing archived. Archive a row with A." },
];

interface Props {
	rows: ApplicationRow[];
	total: number;
	view: KyuuView;
	filtered: boolean;
	sources: string[];
	sort: SortField;
	dir: "asc" | "desc";
	/** 0-based. */
	page: number;
	pageCount: number;
	today: string;
}

/** All: every application, by view, searchable and sortable. */
export function AllView({
	rows,
	total,
	view,
	filtered,
	sources,
	sort,
	dir,
	page,
	pageCount,
	today,
}: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	function href(changes: Record<string, string | null>) {
		const params = new URLSearchParams(searchParams.toString());
		for (const [k, v] of Object.entries(changes)) {
			if (v === null) params.delete(k);
			else params.set(k, v);
		}
		const qs = params.toString();
		return qs ? `${pathname}?${qs}` : pathname;
	}

	function sortBy(field: SortField) {
		startNavigationProgress();
		router.push(
			href(
				sort === field
					? { dir: dir === "asc" ? "desc" : "asc", page: null }
					: { sort: field === "date" ? null : field, dir: null, page: null },
			),
		);
	}

	const header = (field: SortField, label: string, className?: string) => (
		<button
			type="button"
			onClick={() => sortBy(field)}
			aria-label={`Sort by ${label.toLowerCase()}`}
			className={cn(
				"flex items-center gap-1 rounded-sm text-left outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
				sort === field && "text-foreground",
				className,
			)}
		>
			{label}
			{sort === field && <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span>}
		</button>
	);

	return (
		<ApplicationArea rows={rows}>
			<h1 className="sr-only">Kyuu — all applications</h1>
			<UnderlineTabs label="Views">
				{VIEWS.map((v) => (
					<UnderlineTab
						key={v.value}
						href={href({ view: v.value === "all" ? null : v.value, page: null })}
						current={view === v.value}
					>
						{v.label}
					</UnderlineTab>
				))}
			</UnderlineTabs>

			<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0 flex-1">
					<KyuuFilters sources={sources} />
				</div>
				<p className="text-sm text-muted-foreground">
					<span className="font-figures">{total}</span>{" "}
					{total === 1 ? "application" : "applications"}
				</p>
			</div>

			<div className="mt-6">
				<div
					className={cn(
						TABLE_GRID,
						"border-b border-rule pb-2 text-xs text-muted-foreground md:-mx-2 md:px-2",
					)}
				>
					{header("date", "Sent", "max-sm:hidden")}
					{header("company", "Company")}
					<span className="max-sm:hidden">Source</span>
					{header("status", "Status", "justify-end sm:justify-start")}
					<span className="max-lg:hidden">Next</span>
					<span />
				</div>
				{rows.length === 0 ? (
					<p className="py-8 text-sm text-muted-foreground">
						{filtered
							? "Nothing matches these filters."
							: (VIEWS.find((v) => v.value === view)?.empty ?? "")}
					</p>
				) : (
					<ol className="divide-y divide-rule">
						{rows.map((row, i) => (
							<ApplicationRowItem key={row.id} row={row} today={today} table index={i} />
						))}
					</ol>
				)}
			</div>

			{pageCount > 1 && (
				<nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2 text-sm">
					<PageLink href={page > 0 ? href({ page: page > 1 ? String(page - 1) : null }) : null}>
						Previous
					</PageLink>
					<span className="font-figures text-muted-foreground">
						{page + 1} / {pageCount}
					</span>
					<PageLink href={page + 1 < pageCount ? href({ page: String(page + 1) }) : null}>
						Next
					</PageLink>
				</nav>
			)}
		</ApplicationArea>
	);
}

function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
	if (!href)
		return (
			<Button variant="outline" disabled>
				{children}
			</Button>
		);
	return (
		<Button asChild variant="outline">
			<Link href={href} prefetch scroll={false}>
				{children}
			</Link>
		</Button>
	);
}
