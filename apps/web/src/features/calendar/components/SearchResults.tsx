import { Row } from "@/features/calendar/components/parts";
import type { Found } from "@/features/calendar/lib/search";

const DAY = new Intl.DateTimeFormat("en-GB", {
	weekday: "short",
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

/** What a search found: ahead first, then behind, each row on its day. */
export function SearchResults({ q, found, today }: { q: string; found: Found[]; today: string }) {
	if (found.length === 0)
		return (
			<p className="rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-6 text-center text-sm text-muted-foreground">
				No events with “{q}”.
			</p>
		);
	const ahead = found.filter((f) => f.date >= today);
	const behind = found.filter((f) => f.date < today);
	return (
		<div className="space-y-6">
			{[
				["Ahead", ahead],
				["Behind", behind],
			].map(([label, rows]) =>
				(rows as Found[]).length === 0 ? null : (
					<section key={label as string} aria-label={label as string} className="space-y-2">
						<h2 className="px-1 text-xs font-medium text-muted-foreground">{label as string}</h2>
						<ul className="inset-group">
							{(rows as Found[]).map((f) => (
								<Row
									key={f.key}
									entry={{
										...f,
										note: [DAY.format(new Date(`${f.date}T00:00:00Z`)), f.note].join(" · "),
									}}
									done={f.date < today}
								/>
							))}
						</ul>
					</section>
				),
			)}
		</div>
	);
}
