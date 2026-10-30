"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { SegmentedTab, SegmentedTabs } from "@/components/SegmentedTabs";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { KyuuView } from "../lib/kyuu-schemas";
import type { SortField } from "../lib/search-params";
import { GHOST_DAYS } from "../lib/stages";
import type { ApplicationRow } from "../lib/types";
import { ApplicationArea, useApplicationArea } from "./ApplicationArea";
import { ApplicationRowItem, TABLE_GRID } from "./ApplicationRowItem";
import { KyuuFilters } from "./KyuuFilters";

const VIEWS: { value: KyuuView; label: string; empty: string }[] = [
	{ value: "all", label: "All", empty: "No applications yet. Add one with N." },
	{ value: "queue", label: "Not sent", empty: "Nothing waiting to be sent." },
	{ value: "waiting", label: "Waiting", empty: "Nothing waiting for an answer." },
	{ value: "active", label: "In progress", empty: "Nothing in progress." },
	{ value: "closed", label: "Closed", empty: "Nothing closed." },
	{ value: "archived", label: "Archived", empty: "Nothing archived. Archive a row with A." },
];

interface Props {
	rows: ApplicationRow[];
	counts: Record<KyuuView, number>;
	/** Sent, quiet for GHOST_DAYS: closed at once from the Waiting view. */
	ghostDue: string[];
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

/** The applications table: every application by view, searchable, sortable. */
export function AllView({
	rows,
	counts,
	ghostDue,
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
			<h1 className="sr-only">Kyuu — applications</h1>
			<SegmentedTabs label="Views">
				{VIEWS.map((v) => (
					<SegmentedTab
						key={v.value}
						href={href({ view: v.value === "all" ? null : v.value, page: null })}
						current={view === v.value}
					>
						{v.label}
						<span className="ml-1.5 font-figures text-xs text-muted-foreground">
							{counts[v.value]}
						</span>
					</SegmentedTab>
				))}
			</SegmentedTabs>

			<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0 flex-1">
					<KyuuFilters sources={sources} />
				</div>
				<p className="text-sm text-muted-foreground">
					<span className="font-figures">{total}</span>{" "}
					{total === 1 ? "application" : "applications"}
				</p>
			</div>

			{view === "waiting" && ghostDue.length > 0 && <GhostBar ids={ghostDue} />}

			<div className="mt-6">
				<div
					className={cn(
						TABLE_GRID,
						"border-b border-rule pb-2 text-xs text-muted-foreground md:-mx-2 md:px-2",
					)}
				>
					{header("date", "Sent", "max-sm:hidden")}
					{header("company", "Company")}
					<span className="max-md:hidden">Role</span>
					<span className="max-md:hidden">Country</span>
					<span className="max-md:hidden">Source</span>
					{header("status", "Status", "justify-end sm:justify-start")}
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
						{rows.map((row) => (
							<ApplicationRowItem key={row.id} row={row} today={today} />
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

/** Waiting: the ones quiet for GHOST_DAYS, closed as ghosted in one go. */
function GhostBar({ ids }: { ids: string[] }) {
	const { actions } = useApplicationArea();
	const [confirming, setConfirming] = useState(false);
	return (
		<div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3">
			<p className="text-sm">
				<span className="font-figures font-medium">{ids.length}</span>{" "}
				<span className="text-muted-foreground">
					{ids.length === 1 ? "has" : "have"} had no answer for {GHOST_DAYS}+ days.
				</span>
			</p>
			<Button variant="outline" onClick={() => setConfirming(true)}>
				Close as ghosted
			</Button>
			<ConfirmDelete
				open={confirming}
				onOpenChange={setConfirming}
				confirmLabel={`Close ${ids.length}`}
				title={`Close ${ids.length} as ghosted?`}
				description={`Each was sent ${GHOST_DAYS}+ days ago with no answer. They move to Closed, logged today; any can be reopened if the company comes back.`}
				onConfirm={async () => actions.ghost(ids)}
			/>
		</div>
	);
}
