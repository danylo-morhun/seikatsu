"use client";

import { Button } from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Spinner } from "@/components/Spinner";
import { createCalendarFeed, removeCalendarFeed } from "@/features/seiryu/actions/calendar";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

/**
 * Settings: the cards with a due date in the phone's calendar. The link is shown once when
 * made (it's kept hashed); a new one replaces it, Turn off removes it.
 */
export function SettingsCalendar({ madeOn }: { madeOn: string | null }) {
	const [url, setUrl] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [isPending, startTransition] = useTransition();

	function make() {
		startTransition(async () => {
			const result = await createCalendarFeed().catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
			else setUrl(result.url);
		});
	}

	async function turnOff() {
		const result = await removeCalendarFeed().catch(() => FAILED);
		if ("error" in result) toast.error(result.error);
		else setUrl(null);
	}

	const webcal = url?.replace(/^https?:/, "webcal:");

	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">
				Open cards with a due date, in Apple or Google Calendar: a time is an event at that hour, a
				day alone is an all-day one. Calendars refresh it on their own, about hourly.
			</p>

			{url ? (
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<code className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1.5 font-mono text-xs">
							{url}
						</code>
						<Button
							size="sm"
							variant="outline"
							onClick={() =>
								navigator.clipboard
									.writeText(url)
									.then(() => toast.success("Link copied"))
									.catch(() => toast.error("Couldn't copy"))
							}
						>
							Copy
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						Shown this once — anyone with it sees the cards' titles. Apple:{" "}
						<a className="underline underline-offset-2" href={webcal}>
							add to Calendar
						</a>
						. Google:{" "}
						<a
							className="underline underline-offset-2"
							href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal ?? "")}`}
							target="_blank"
							rel="noreferrer"
						>
							add by URL
						</a>
						.
					</p>
				</div>
			) : (
				madeOn && (
					<p className="text-sm">
						A link is on, made {madeOn}. Lost it? Make a new one; the old one stops working.
					</p>
				)
			)}

			<div className="flex flex-wrap gap-2">
				<Button variant="outline" className="gap-1.5" disabled={isPending} onClick={make}>
					{isPending && <Spinner />}
					{madeOn || url ? "New link" : "Make a link"}
				</Button>
				{(madeOn || url) && (
					<Button
						variant="ghost"
						className="text-muted-foreground hover:text-foreground"
						disabled={isPending}
						onClick={() => setConfirming(true)}
					>
						Turn off
					</Button>
				)}
			</div>

			<ConfirmDelete
				open={confirming}
				onOpenChange={setConfirming}
				title="Turn off the calendar link?"
				description="Calendars subscribed to it stop getting the cards."
				confirmLabel="Turn off"
				onConfirm={turnOff}
			/>
		</div>
	);
}
