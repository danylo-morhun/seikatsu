"use client";

import { Button, Checkbox, Label } from "@seikatsu/ui";
import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Spinner } from "@/components/Spinner";
import { disconnectGoogle, setCalendarShown, syncNow } from "@/features/calendar/actions/google";
import type { GoogleSettings as Settings } from "@/features/calendar/google/settings";

const AGO = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function ago(at: Date): string {
	const minutes = Math.round((at.getTime() - Date.now()) / 60_000);
	if (minutes > -60) return AGO.format(minutes, "minute");
	const hours = Math.round(minutes / 60);
	return hours > -24 ? AGO.format(hours, "hour") : AGO.format(Math.round(hours / 24), "day");
}

/** Not connected: what it does, and the way to Google's consent. */
export function ConnectGoogle({ error }: { error?: string }) {
	return (
		<div className="group-card space-y-3">
			<p className="text-sm text-muted-foreground">
				Your Google calendars show on seikatsu's calendar, and you can move or change their events
				from here. seikatsu writes its own rows (your events, cards due, booked calls, the car,
				bills) to a calendar of their own, "seikatsu"; change one there and it changes here.
			</p>
			{error && (
				<p role="alert" className="text-[0.8rem] text-destructive">
					{error}
				</p>
			)}
			<Button asChild>
				<a href="/api/calendar/google/connect">Connect Google Calendar</a>
			</Button>
		</div>
	);
}

/** Connected: the account, its calendars to show, sync now, disconnect. */
export function GoogleAccount({ settings }: { settings: NonNullable<Settings> }) {
	const id = useId();
	const [syncing, startSync] = useTransition();
	const [leaving, setLeaving] = useState(false);
	const [, startToggle] = useTransition();
	const [calendars, setOptimistic] = useOptimistic(
		settings.calendars,
		(list, next: { id: string; shown: boolean }) =>
			list.map((c) => (c.id === next.id ? { ...c, shown: next.shown } : c)),
	);

	return (
		<div className="space-y-6">
			<ul className="inset-group">
				<li className="flex flex-wrap items-center gap-3 py-3">
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm">{settings.email}</p>
						<p className="mt-0.5 text-sm text-muted-foreground">
							{settings.lastError
								? `Last sync failed: ${settings.lastError}`
								: settings.lastSyncedAt
									? `Synced ${ago(new Date(settings.lastSyncedAt))}`
									: "First sync on its way"}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5"
						disabled={syncing}
						onClick={() =>
							startSync(async () => {
								const result = await syncNow().catch(() => ({ error: "Couldn't reach seikatsu" }));
								if ("error" in result) toast.error(result.error);
							})
						}
					>
						{syncing && <Spinner />}
						{syncing ? "Syncing…" : "Sync now"}
					</Button>
				</li>
			</ul>

			<ul className="inset-group" aria-label="Calendars">
				{calendars.map((c) => (
					<li key={c.id} className="flex items-start gap-3 py-3">
						<Checkbox
							id={`${id}-${c.id}`}
							checked={c.own || c.shown}
							disabled={c.own}
							onCheckedChange={(v) =>
								startToggle(async () => {
									setOptimistic({ id: c.id, shown: v === true });
									const result = await setCalendarShown({ id: c.id, shown: v === true }).catch(
										() => ({ error: "Couldn't save. Check your connection." }),
									);
									if ("error" in result) toast.error(result.error);
								})
							}
							className="mt-0.5"
						/>
						<div className="min-w-0 flex-1">
							<Label
								htmlFor={`${id}-${c.id}`}
								className="flex items-center gap-2 text-sm font-normal"
							>
								<span
									aria-hidden
									className="size-2.5 shrink-0 rounded-full bg-(--dot)"
									style={{ "--dot": c.color ?? "var(--muted-foreground)" } as React.CSSProperties}
								/>
								<span className="truncate">{c.name}</span>
							</Label>
							<p className="mt-0.5 text-sm text-muted-foreground">
								{c.own
									? "seikatsu's own rows, kept in step both ways"
									: c.writable
										? "Shown on the calendar; its events can be moved and changed here"
										: "Shown on the calendar, read only"}
							</p>
						</div>
					</li>
				))}
			</ul>

			<Button
				variant="ghost"
				className="text-muted-foreground hover:text-destructive"
				onClick={() => setLeaving(true)}
			>
				Disconnect
			</Button>
			<ConfirmDelete
				open={leaving}
				onOpenChange={setLeaving}
				title="Disconnect Google Calendar?"
				description={`seikatsu stops reading ${settings.email}'s calendars and writing to "seikatsu". That calendar stays in Google with what's in it.`}
				confirmLabel="Disconnect"
				onConfirm={async () => {
					const result = await disconnectGoogle();
					if ("error" in result) toast.error(result.error);
					else setLeaving(false);
				}}
			/>
		</div>
	);
}
