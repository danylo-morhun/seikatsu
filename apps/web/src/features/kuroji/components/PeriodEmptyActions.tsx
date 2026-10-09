"use client";

import { buildPeriodLabel, previousRange } from "@/features/kuroji/lib/dates";
import { Button } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface Props {
	/** The resolved period on screen; both undefined means all time. */
	from?: string;
	to?: string;
}

/**
 * An empty period isn't an empty ledger: offer the previous period and all time
 * instead of "record your first entry". Other params (tab, filters) are kept.
 */
export function PeriodEmptyActions({ from, to }: Props) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	if (!from || !to) return null;

	function href(range: { from: string; to: string } | "all") {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("page");
		if (range === "all") {
			params.delete("from");
			params.delete("to");
			params.set("all", "1");
		} else {
			params.delete("all");
			params.set("from", range.from);
			params.set("to", range.to);
		}
		return `${pathname}?${params.toString()}`;
	}

	const prev = previousRange(from, to);

	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			<Button asChild variant="outline" size="sm">
				<Link href={href(prev)} prefetch>
					Show {buildPeriodLabel(prev.from, prev.to)}
				</Link>
			</Button>
			<Button asChild variant="ghost" size="sm">
				<Link href={href("all")} prefetch>
					Show all time
				</Link>
			</Button>
		</div>
	);
}
