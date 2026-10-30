"use client";

import { Spinner } from "@/components/Spinner";
import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	cn,
} from "@seikatsu/ui";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
	type MailChoice,
	type MailItem,
	confirmMail,
	dismissMail,
	markMailSeen,
	undoMail,
} from "../actions/mail";
import { formatDay, formatWhen } from "../lib/format";
import { STATUS_OF_EVENT } from "../lib/stages";
import { StatusMark } from "./StatusMark";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

/** Above the table: answers read from mail — the ones logged on their own, and the unsure ones. */
export function MailInbox({
	items,
	choices,
	today,
}: {
	items: MailItem[];
	choices: MailChoice[];
	today: string;
}) {
	const [isClearing, startClearing] = useTransition();
	if (items.length === 0) return null;
	const review = items.filter((i) => i.state === "review");
	const applied = items.filter((i) => i.state === "applied");

	return (
		<section aria-label="From mail" className="mb-6 animate-rise rounded-lg bg-surface px-4 py-3">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-sm font-medium">
					From mail
					<span className="ml-2 font-normal text-muted-foreground">
						{[
							applied.length > 0 && `${applied.length} logged`,
							review.length > 0 && `${review.length} to check`,
						]
							.filter(Boolean)
							.join(" · ")}
					</span>
				</h2>
				{applied.length > 0 && (
					<Button
						variant="ghost"
						size="sm"
						className="gap-1.5 text-muted-foreground"
						disabled={isClearing}
						onClick={() =>
							startClearing(async () => {
								const result = await markMailSeen(applied.map((i) => i.id)).catch(() => FAILED);
								if ("error" in result) toast.error(result.error);
							})
						}
					>
						{isClearing && <Spinner />}
						Clear logged
					</Button>
				)}
			</div>
			<ul className="mt-2 inset-group">
				{[...review, ...applied].map((item) => (
					<MailRow key={item.id} item={item} choices={choices} today={today} />
				))}
			</ul>
		</section>
	);
}

function MailRow({
	item,
	choices,
	today,
}: {
	item: MailItem;
	choices: MailChoice[];
	today: string;
}) {
	const [isPending, startTransition] = useTransition();
	const [picked, setPicked] = useState(item.application?.id ?? "");
	const status = STATUS_OF_EVENT[item.kind] ?? "applied";
	const booked =
		item.eventDate && (item.kind === "screening" || item.kind === "interview")
			? formatWhen(item.eventDate, item.eventTime, today)
			: undefined;

	function run(action: () => Promise<{ error: string } | { success: true }>, done?: string) {
		startTransition(async () => {
			const result = await action().catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
			else if (done) toast(done);
		});
	}

	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
			<div className="min-w-0 flex-1 basis-64">
				<div className="flex min-w-0 items-center gap-2">
					<StatusMark status={status} detail={booked} />
					{item.application && item.state === "applied" ? (
						<Link
							href={`/kyuu/${item.application.id}`}
							prefetch={false}
							className="truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
						>
							{item.application.company}
						</Link>
					) : null}
				</div>
				<p className="mt-0.5 truncate text-xs text-muted-foreground">
					{item.summary ?? item.subject}
					{item.receivedAt && (
						<span className="font-figures">
							{" "}
							· {formatDay(item.receivedAt.slice(0, 10), today)}
						</span>
					)}
					{item.link && (
						<a
							href={item.link}
							target="_blank"
							rel="noopener noreferrer"
							title={item.subject ?? "Open in Gmail"}
							aria-label="Open in Gmail"
							className="ml-1.5 inline-flex rounded-sm align-[-2px] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						>
							<HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5" />
						</a>
					)}
				</p>
			</div>

			{item.state === "review" ? (
				<div className="flex items-center gap-2 max-sm:w-full">
					<Select value={picked} onValueChange={setPicked}>
						<SelectTrigger
							aria-label="Which application"
							className={cn("w-56 max-sm:flex-1", !picked && "text-muted-foreground")}
						>
							<SelectValue placeholder="Which application?" />
						</SelectTrigger>
						<SelectContent>
							{choices.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.company} · <span className="text-muted-foreground">{c.role}</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						variant="outline"
						className="gap-1.5"
						disabled={isPending || !picked}
						onClick={() =>
							run(async () => {
								const result = await confirmMail(item.id, picked);
								if ("success" in result && !result.data.logged) toast("Already on its timeline");
								return result;
							})
						}
					>
						{isPending && <Spinner />}
						Log
					</Button>
					<Button
						variant="ghost"
						className="text-muted-foreground"
						disabled={isPending}
						onClick={() => run(() => dismissMail(item.id))}
					>
						Dismiss
					</Button>
				</div>
			) : (
				<Button
					variant="ghost"
					size="sm"
					className="gap-1.5 text-muted-foreground"
					disabled={isPending}
					onClick={() => run(() => undoMail(item.id), "Undone")}
				>
					{isPending && <Spinner />}
					Undo
				</Button>
			)}
		</li>
	);
}
