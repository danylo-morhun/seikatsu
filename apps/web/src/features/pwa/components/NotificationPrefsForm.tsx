"use client";

import { type PrefsInput, saveNotificationPrefs } from "@/features/pwa/actions/push";
import type { NotificationPrefs } from "@seikatsu/db";
import { Checkbox, Input, Label } from "@seikatsu/ui";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

type BoolKey = {
	[K in keyof PrefsInput]: PrefsInput[K] extends boolean ? K : never;
}[keyof PrefsInput];
type TimeKey = "keizokuTime" | "morningTime";

interface Row {
	key: BoolKey;
	app: string;
	label: string;
	detail: string;
	/** The time this one goes out at, editable beside it. */
	time?: TimeKey;
}

// One row per notifier the cron actually runs (app/api/cron/notify/route.ts).
const ROWS: Row[] = [
	{
		key: "keizokuEnabled",
		app: "継 Keizoku",
		label: "Evening reminder",
		detail: "The habits still open today. Nothing if they're all done.",
		time: "keizokuTime",
	},
];

const DEFAULTS: PrefsInput = {
	timeZone: "UTC",
	morningTime: "09:00",
	keizokuEnabled: true,
	keizokuTime: "21:00",
	kyuuEnabled: true,
	aishaEnabled: true,
	kurojiRecurring: true,
	kurojiBudget: true,
	kurojiWeekly: true,
};

const hhmm = (t: string) => t.slice(0, 5);

function fromPrefs(prefs: NotificationPrefs | null): PrefsInput {
	if (!prefs) return DEFAULTS;
	const { workspaceId: _, updatedAt: __, ...rest } = prefs;
	return { ...rest, keizokuTime: hhmm(rest.keizokuTime), morningTime: hhmm(rest.morningTime) };
}

/** What gets sent and when. Saves as you go; times are in this device's time zone. */
export function NotificationPrefsForm({ prefs }: { prefs: NotificationPrefs | null }) {
	const id = useId();
	const [values, setValues] = useState(() => fromPrefs(prefs));
	const saved = useRef(values);

	async function save(next: PrefsInput) {
		const previous = saved.current;
		const withZone = { ...next, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
		setValues(withZone);
		const result = await saveNotificationPrefs(withZone).catch(() => ({
			error: "Couldn't save. Check your connection.",
		}));
		if ("error" in result) {
			setValues(previous);
			toast.error(result.error);
			return;
		}
		saved.current = withZone;
	}

	return (
		<ul className="divide-y divide-rule">
			{ROWS.map((row) => (
				<li key={row.key} className="flex items-start gap-3 py-4 first:pt-0">
					<Checkbox
						id={`${id}-${row.key}`}
						checked={values[row.key]}
						onCheckedChange={(checked) => save({ ...values, [row.key]: checked === true })}
						className="mt-0.5"
					/>
					<div className="min-w-0 flex-1">
						<Label htmlFor={`${id}-${row.key}`} className="text-sm font-medium">
							<span className="text-muted-foreground">{row.app}</span> · {row.label}
						</Label>
						<p className="mt-0.5 text-sm text-muted-foreground">{row.detail}</p>
					</div>
					{row.time && (
						<Input
							type="time"
							aria-label={`${row.label} time`}
							value={values[row.time]}
							disabled={!values[row.key]}
							onChange={(e) => {
								const time = row.time;
								if (time) setValues((v) => ({ ...v, [time]: e.target.value }));
							}}
							onBlur={() => {
								if (row.time && values[row.time] !== saved.current[row.time] && values[row.time]) {
									save(values);
								}
							}}
							className="w-28 shrink-0"
						/>
					)}
				</li>
			))}
		</ul>
	);
}
