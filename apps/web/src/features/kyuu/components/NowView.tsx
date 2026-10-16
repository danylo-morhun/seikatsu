"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FIGURES_ROW, Figure } from "@/features/keizoku/components/Figure";
import { Button } from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, useMemo, useState } from "react";
import type { NowData } from "../actions/applications";
import { requestNewApplication, requestOpenApplication } from "../lib/events";
import { formatWhen } from "../lib/format";
import { EVENT_LABELS, GHOST_DAYS } from "../lib/stages";
import type { ApplicationRow } from "../lib/types";
import { ApplicationArea, useApplicationArea } from "./ApplicationArea";
import { ApplicationRowItem } from "./ApplicationRowItem";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;
/** Rows of the long "no answer" list shown before "Show all". */
const GHOST_PREVIEW = 8;

/** Now: what to send, what's booked, what's moving, who to nudge, who to let go. */
export function NowView({ data, today }: { data: NowData; today: string }) {
	const rows = useMemo(
		() => [...data.toSend, ...data.inProgress, ...data.followUp, ...data.ghost],
		[data],
	);
	const waiting = data.quiet + data.followUp.length + data.ghost.length;
	const empty = rows.length === 0 && data.upcoming.length === 0;

	return (
		<ApplicationArea rows={rows}>
			<h1 className="sr-only">Kyuu — now</h1>
			<section aria-label="At a glance" className={`${FIGURES_ROW} md:grid-cols-4`}>
				<Figure
					lead
					index={0}
					label="To send"
					value={data.toSend.length}
					note={
						data.toSend.length > 0 ? "The pipeline couldn't send these" : "Nothing waiting on you"
					}
				/>
				<Figure
					index={1}
					label="Booked"
					value={data.upcoming.length}
					note={
						data.upcoming[0]?.date
							? `Next: ${formatWhen(data.upcoming[0].date, data.upcoming[0].time, today)}`
							: "No calls booked"
					}
				/>
				<Figure
					index={2}
					label="In progress"
					value={data.inProgress.length}
					note="Screening, interview or offer"
				/>
				<Figure
					index={3}
					label="Waiting"
					value={waiting}
					note={
						data.ghost.length > 0
							? `${data.ghost.length} quiet for ${GHOST_DAYS}+ days`
							: "Sent, no answer yet"
					}
				/>
			</section>

			{empty ? (
				<div className="mt-12 max-w-md animate-rise space-y-3" style={rise(4)}>
					<p className="text-sm text-muted-foreground">
						Nothing needs you right now. Applications the pipeline sends land here when they need a
						hand, a call gets booked, or a company goes quiet.
					</p>
					<Button onClick={requestNewApplication} aria-keyshortcuts="N">
						New application
					</Button>
				</div>
			) : (
				<div className="mt-10 space-y-10">
					{data.upcoming.length > 0 && (
						<Section title="Booked" count={data.upcoming.length} index={4}>
							{data.upcoming.map((e) => (
								<li key={e.id}>
									<button
										type="button"
										onClick={() => requestOpenApplication(e.application.id)}
										className="grid w-full grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-x-4 rounded-md py-2.5 text-left outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring md:-mx-2 md:w-[calc(100%+1rem)] md:px-2"
									>
										<span className="text-sm font-medium text-primary">
											{e.date ? formatWhen(e.date, e.time, today) : "—"}
										</span>
										<span className="min-w-0">
											<span className="block truncate text-sm">
												{EVENT_LABELS[e.kind]} · {e.application.company}
											</span>
											<span className="block truncate text-xs text-muted-foreground">
												{e.note ?? e.application.role}
											</span>
										</span>
									</button>
								</li>
							))}
						</Section>
					)}

					{data.toSend.length > 0 && (
						<Section
							title="To send"
							count={data.toSend.length}
							index={5}
							hint="Open the posting (O), send it, then mark it sent (X)."
						>
							{data.toSend.map((row, i) => (
								<ApplicationRowItem key={row.id} row={row} today={today} showReason index={i} />
							))}
						</Section>
					)}

					{data.inProgress.length > 0 && (
						<Section title="In progress" count={data.inProgress.length} index={6}>
							{data.inProgress.map((row, i) => (
								<ApplicationRowItem key={row.id} row={row} today={today} index={i} />
							))}
						</Section>
					)}

					{data.followUp.length > 0 && (
						<Section
							title="Follow up"
							count={data.followUp.length}
							index={7}
							hint="A week without an answer. Nudge them, then mark it (F)."
						>
							{data.followUp.map((row, i) => (
								<ApplicationRowItem key={row.id} row={row} today={today} index={i} />
							))}
						</Section>
					)}

					{data.ghost.length > 0 && <GhostSection rows={data.ghost} today={today} />}

					<p className="animate-rise text-sm text-muted-foreground" style={rise(9)}>
						{data.quiet > 0 && (
							<>
								<Link
									href="/kyuu/all?view=waiting"
									prefetch
									className="text-foreground underline-offset-2 hover:underline"
								>
									{data.quiet} more
								</Link>{" "}
								sent recently, nothing due yet.{" "}
							</>
						)}
						{data.sourced > 0 && (
							<>
								<Link
									href="/kyuu/all?view=queue"
									prefetch
									className="text-foreground underline-offset-2 hover:underline"
								>
									{data.sourced} sourced
								</Link>{" "}
								by the scraper, not triaged.
							</>
						)}
					</p>
				</div>
			)}
		</ApplicationArea>
	);
}

function Section({
	title,
	count,
	hint,
	index,
	action,
	children,
}: {
	title: string;
	count: number;
	hint?: string;
	index: number;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	const id = `kyuu-${title.toLowerCase().replace(/\W+/g, "-")}`;
	return (
		<section aria-labelledby={id} className="animate-rise" style={rise(index)}>
			<div className="flex items-end justify-between gap-3 border-b border-rule pb-2">
				<div className="min-w-0">
					<h2 id={id} className="text-sm font-medium">
						{title} <span className="ml-1 font-figures text-muted-foreground">{count}</span>
					</h2>
					{hint && <p className="mt-0.5 text-xs text-muted-foreground max-sm:hidden">{hint}</p>}
				</div>
				{action}
			</div>
			<ol className="divide-y divide-rule">{children}</ol>
		</section>
	);
}

function GhostSection({ rows, today }: { rows: ApplicationRow[]; today: string }) {
	const { actions, shown } = useApplicationArea();
	const [all, setAll] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const open = rows.filter((r) => shown(r).status === "applied");
	const visible = all ? rows : rows.slice(0, GHOST_PREVIEW);

	return (
		<>
			<Section
				title={`No answer for ${GHOST_DAYS}+ days`}
				count={open.length}
				index={8}
				hint="Close one (G), or all of them at once. They stay in All and in the stats."
				action={
					open.length > 1 && (
						<Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
							Close all {open.length}
						</Button>
					)
				}
			>
				{visible.map((row, i) => (
					<ApplicationRowItem key={row.id} row={row} today={today} index={i} />
				))}
			</Section>
			{rows.length > GHOST_PREVIEW && (
				<Button
					variant="ghost"
					size="sm"
					className="-mt-8 text-muted-foreground"
					onClick={() => setAll(!all)}
				>
					{all ? "Show fewer" : `Show all ${rows.length}`}
				</Button>
			)}
			<ConfirmDelete
				open={confirming}
				onOpenChange={setConfirming}
				confirmLabel={`Close ${open.length}`}
				title={`Close ${open.length} as ghosted?`}
				description={`Each was sent ${GHOST_DAYS}+ days ago with no answer. They move to Ghosted, logged today; any of them can be reopened if the company comes back.`}
				onConfirm={async () => {
					actions.ghost(open.map((r) => r.id));
				}}
			/>
		</>
	);
}
