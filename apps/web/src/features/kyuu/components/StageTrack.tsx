import { cn } from "@seikatsu/ui";
import { formatDay } from "../lib/format";
import { CLOSED, type EventKind, STATUS_CONFIG, type Status } from "../lib/stages";
import type { KyuuEvent } from "../lib/types";
import { STATUS_LOOK } from "./StatusMark";

const STAGES: { label: string; kind: EventKind | null; status: Status }[] = [
	{ label: "Sent", kind: null, status: "applied" },
	{ label: "Screening", kind: "screening", status: "hr_screening" },
	{ label: "Interview", kind: "interview", status: "technical_interview" },
	{ label: "Offer", kind: "offer", status: "offer" },
];
const RANK: Partial<Record<Status, number>> = {
	applied: 0,
	hr_screening: 1,
	technical_interview: 2,
	offer: 3,
};

/**
 * How far it got: Sent → Screening → Interview → Offer, each with its day. A closed one
 * shows where it stopped.
 */
export function StageTrack({
	status,
	events,
	dateApplied,
	today,
}: {
	status: Status;
	events: KyuuEvent[];
	dateApplied: string;
	today: string;
}) {
	const unsent = status === "sourced" || status === "drafted";
	// The furthest stage: from the status, or from events (a closed one keeps what it reached).
	let reached = unsent ? -1 : (RANK[status] ?? 0);
	STAGES.forEach((s, i) => {
		if (s.kind && events.some((e) => e.kind === s.kind)) reached = Math.max(reached, i);
	});
	const closed = CLOSED.includes(status);
	const ending = closed
		? events
				.filter((e) => e.kind === "rejected" || e.kind === "withdrawn" || e.kind === "ghosted")
				.at(-1)
		: undefined;

	function dayOf(i: number): { text: string; ahead: boolean } | null {
		if (i === 0) return unsent ? null : { text: formatDay(dateApplied, today), ahead: false };
		const kind = STAGES[i].kind;
		const dated = events.filter((e) => e.kind === kind && e.date).map((e) => e.date as string);
		const past = dated.filter((d) => d <= today);
		if (past.length > 0) return { text: formatDay(past[0], today), ahead: false };
		if (dated.length > 0) return { text: formatDay(dated[0], today), ahead: true };
		return i <= reached ? { text: "day unknown", ahead: false } : null;
	}

	return (
		<ol aria-label="Stages" className="flex items-start">
			{STAGES.map((stage, i) => {
				const done = i <= reached;
				const day = dayOf(i);
				const tone = STATUS_LOOK[stage.status].className;
				return (
					<li key={stage.label} className="flex min-w-0 flex-1 flex-col">
						<div className="flex items-center">
							<span
								aria-hidden
								className={cn(
									"size-3 shrink-0 rounded-full",
									done ? cn("bg-current", tone) : "shadow-[inset_0_0_0_1.5px_var(--rule)]",
									day?.ahead && "shadow-[inset_0_0_0_1.5px_currentColor] bg-transparent",
								)}
							/>
							{i < STAGES.length - 1 && (
								<span
									aria-hidden
									className={cn(
										"mx-2 h-px flex-1",
										i < reached ? "bg-foreground/30" : "bg-rule",
										closed && i === reached && "bg-transparent",
									)}
								/>
							)}
						</div>
						<span
							className={cn(
								"mt-2 text-sm font-medium",
								done ? "text-foreground" : "text-muted-foreground",
							)}
						>
							{stage.label}
							<span className="sr-only">{done ? ", reached" : ", not reached"}</span>
						</span>
						<span className={cn("text-xs", day?.ahead ? "text-primary" : "text-muted-foreground")}>
							{day ? (day.ahead ? `booked ${day.text}` : day.text) : " "}
						</span>
						{closed && i === Math.max(reached, 0) && (
							<span className={cn("mt-1 text-xs font-medium", STATUS_LOOK[status].className)}>
								{STATUS_CONFIG[status].label}
								{ending?.date ? ` ${formatDay(ending.date, today)}` : ""}
							</span>
						)}
					</li>
				);
			})}
		</ol>
	);
}
