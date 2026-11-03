"use client";

// The home's working parts: the capture bar and the day's list, where each row's one action is
// done right here, through its app's own (offline-capable) helper.

import { ArrowRight01Icon, QuillWrite01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Kbd } from "@/components/Kbd";
import { loadDialog } from "@/features/capture/components/CaptureButton";
import { openCapture } from "@/features/capture/lib/key";
import type { QueueItem } from "@/features/home/lib/queue";
import { sendMove } from "@/features/hoshii/lib/offline";
import { ghostApplications } from "@/features/kyuu/actions/progress";
import { placeCard } from "@/features/seiryu/lib/offline";
import { APPS_CONFIG } from "@/lib/app-themes";

/** One line about anything: opens capture with it, already reading. */
export function CaptureBar() {
	const [text, setText] = useState("");
	return (
		<form
			className="relative"
			onSubmit={(e) => {
				e.preventDefault();
				openCapture(text.trim());
				setText("");
			}}
		>
			<HugeiconsIcon
				icon={QuillWrite01Icon}
				aria-hidden
				className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				aria-label="Capture: one line about what happened"
				autoComplete="off"
				placeholder="Capture anything"
				value={text}
				onFocus={loadDialog}
				onChange={(e) => setText(e.target.value)}
				className="h-12 w-full rounded-field border border-[var(--search-border)] bg-[var(--search-bg)] pr-14 pl-10 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
			/>
			<Kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 max-sm:hidden">
				⌘K
			</Kbd>
		</form>
	);
}

/** Rows past this wait behind "Show more", so a long day stays one screen. */
const FIRST = 6;

const failed = (result: { error: string } | object): string | null =>
	"error" in result ? result.error : null;

/** The day's list: each row opens its app; its button does the one thing it waits for. */
export function TodayQueue({ items }: { items: QueueItem[] }) {
	// Rows handled here go at once; a failure brings them back.
	const [gone, setGone] = useState<Set<string>>(new Set());
	const [all, setAll] = useState(false);
	const left = items.filter((i) => !gone.has(i.key));
	const shown = all ? left : left.slice(0, FIRST);

	function settle(key: string, run: () => Promise<{ error: string } | object>) {
		setGone((prev) => new Set(prev).add(key));
		void run()
			.catch(() => ({ error: "Couldn't save. Check your connection." }))
			.then((result) => {
				const error = failed(result);
				if (!error) return;
				toast.error(error);
				setGone((prev) => {
					const next = new Set(prev);
					next.delete(key);
					return next;
				});
			});
	}

	if (left.length === 0)
		return (
			<p className="rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-4 text-sm text-muted-foreground">
				Nothing waiting on you. Anything new goes in the line above.
			</p>
		);

	return (
		<div>
			<ul aria-label="Waiting today" className="inset-group">
				{shown.map((item) => (
					<QueueRow key={item.key} item={item} settle={settle} />
				))}
			</ul>
			{left.length > FIRST && (
				<button
					type="button"
					onClick={() => setAll((v) => !v)}
					className="mt-2 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					{all ? "Show less" : `Show ${left.length - FIRST} more`}
				</button>
			)}
		</div>
	);
}

function QueueRow({
	item,
	settle,
}: {
	item: QueueItem;
	settle: (key: string, run: () => Promise<{ error: string } | object>) => void;
}) {
	const app = APPS_CONFIG[item.app];
	const { act } = item;
	return (
		<li className="flex min-h-14 items-center gap-3 py-2">
			<span
				aria-hidden
				className={cn(
					app.theme,
					"flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[13px] font-semibold text-primary",
				)}
			>
				{app.kanji}
			</span>
			<Link href={item.href} prefetch className="group min-w-0 flex-1 outline-none">
				<span className="block truncate text-sm font-medium group-hover:underline group-focus-visible:underline">
					{item.title}
				</span>
				<span
					className={cn(
						"block truncate text-xs",
						item.tone === "overdue" ? "text-negative" : "text-muted-foreground",
					)}
				>
					{item.note}
				</span>
			</Link>
			{act.kind === "done" && (
				<Button
					variant="outline"
					size="sm"
					className="shrink-0 gap-1.5"
					aria-label={`Done: ${item.title}`}
					onClick={() =>
						settle(item.key, () => placeCard(act.cardId, item.title, { columnId: act.columnId }))
					}
				>
					<HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
					Done
				</Button>
			)}
			{act.kind === "decide" && (
				<div className="flex shrink-0 gap-1.5">
					<Button
						variant="ghost"
						size="sm"
						className="text-muted-foreground"
						aria-label={`Let go: ${item.title}`}
						onClick={() =>
							settle(item.key, () => sendMove({ id: act.itemId, title: item.title }, "released"))
						}
					>
						Let go
					</Button>
					<Button
						variant="outline"
						size="sm"
						aria-label={`Keep: ${item.title}`}
						onClick={() =>
							settle(item.key, () => sendMove({ id: act.itemId, title: item.title }, "plan"))
						}
					>
						Keep
					</Button>
				</div>
			)}
			{act.kind === "ghost" && <GhostAll ids={act.ids} onDone={(run) => settle(item.key, run)} />}
			{act.kind === "open" && (
				<HugeiconsIcon
					icon={ArrowRight01Icon}
					aria-hidden
					className="size-4 shrink-0 text-muted-foreground"
				/>
			)}
		</li>
	);
}

function GhostAll({
	ids,
	onDone,
}: {
	ids: string[];
	onDone: (run: () => Promise<{ error: string } | object>) => void;
}) {
	const [confirming, setConfirming] = useState(false);
	return (
		<>
			<Button variant="outline" size="sm" className="shrink-0" onClick={() => setConfirming(true)}>
				Close all
			</Button>
			<ConfirmDelete
				open={confirming}
				onOpenChange={setConfirming}
				confirmLabel={`Close ${ids.length}`}
				title={`Close ${ids.length} as ghosted?`}
				description="They move to Closed, logged today; any can be reopened if the company comes back."
				onConfirm={async () => onDone(() => ghostApplications(ids))}
			/>
		</>
	);
}
