"use client";

import { useDraft } from "@/hooks/useDraft";
import {
	Archive01Icon,
	ArchiveArrowUpIcon,
	ArrowLeft01Icon,
	Copy01Icon,
	Delete01Icon,
	LinkSquare02Icon,
	MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	Label,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	cn,
} from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { patchApplication } from "../actions/applications";
import { followUp, setArchived, setStatus } from "../actions/progress";
import { requestDeleteApplication } from "../lib/events";
import { formatAge, formatDay } from "../lib/format";
import type { ApplicationPatch } from "../lib/kyuu-schemas";
import { type EventKind, STATUSES, type Status } from "../lib/stages";
import type { ApplicationDetail } from "../lib/types";
import { FIELD_TEXTAREA } from "./ApplicationDialog";
import { StageTrack } from "./StageTrack";
import { StatusMark } from "./StatusMark";
import { Timeline } from "./Timeline";

const FAILED = { error: "Couldn't save. Check your connection." } as const;
const rise = (i: number) => ({ "--i": i }) as CSSProperties;

/** One application: where it stands, what happened, the facts, the posting. */
export function ApplicationPage({
	application: app,
	today,
	logKind,
}: {
	application: ApplicationDetail;
	today: string;
	/** An event to log as the page opens (S and I on the table). */
	logKind: EventKind | null;
}) {
	const [, startTransition] = useTransition();
	const [status, setOptimisticStatus] = useOptimistic(app.status);
	const [composer, setComposer] = useState<EventKind | null>(logKind);

	function run(action: () => Promise<{ error: string } | { success: true }>, done?: string) {
		startTransition(async () => {
			const result = await action().catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
			else if (done) toast(done);
		});
	}

	function changeStatus(next: Status) {
		if (next === status) return;
		startTransition(async () => {
			setOptimisticStatus(next);
			const result = await setStatus(app.id, next).catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
		});
	}

	const patch = (p: ApplicationPatch) => run(() => patchApplication(app.id, p));

	const steps = nextSteps(status);

	return (
		<article className="mx-auto max-w-6xl">
			<Link
				href="/kyuu"
				prefetch
				className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden className="size-4" />
				Applications
			</Link>

			<header
				className="mt-5 flex animate-rise flex-wrap items-start gap-x-6 gap-y-4"
				style={rise(0)}
			>
				<div className="min-w-0 flex-1 basis-80">
					<InlineTitle
						value={app.company}
						label="Company"
						className="text-2xl font-semibold tracking-tight"
						onSave={(company) => patch({ company })}
					/>
					<InlineTitle
						value={app.role}
						label="Role"
						className="text-base text-muted-foreground"
						onSave={(role) => patch({ role })}
					/>
					<p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
						{app.jobUrl && (
							<a
								href={app.jobUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
							>
								Posting
								<HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5" />
							</a>
						)}
						{app.source && <span>{app.source}</span>}
						<span>Sent {formatDay(app.dateApplied, today)}</span>
						{app.applyMethod === "auto" && <span>by the pipeline</span>}
						{app.archived && <span className="text-foreground">Archived</span>}
					</p>
				</div>

				<div className="flex items-center gap-1">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" className="gap-2">
								<StatusMark status={status} className="text-sm" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuRadioGroup
								value={status}
								onValueChange={(v) => changeStatus(v as Status)}
							>
								{STATUSES.map((s) => (
									<DropdownMenuRadioItem key={s} value={s}>
										<StatusMark status={s} />
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" aria-label="Application actions">
								<HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-44">
							<DropdownMenuItem
								onClick={() =>
									run(
										() => setArchived(app.id, !app.archived),
										app.archived ? "Restored" : "Archived: it's out of the table's views",
									)
								}
							>
								<HugeiconsIcon
									icon={app.archived ? ArchiveArrowUpIcon : Archive01Icon}
									className="mr-2 size-4"
								/>
								{app.archived ? "Restore" : "Archive"}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() =>
									requestDeleteApplication({
										id: app.id,
										company: app.company,
										afterwards: "/kyuu",
									})
								}
							>
								<HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
								Delete…
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			<div className="mt-8 animate-rise" style={rise(1)}>
				<StageTrack
					status={status}
					events={app.events}
					dateApplied={app.dateApplied}
					today={today}
				/>
			</div>

			<div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
				<div className="min-w-0 space-y-10">
					{(steps.length > 0 || app.waiting) && (
						<section aria-label="Next" className="animate-rise space-y-3" style={rise(2)}>
							{steps.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{steps.map((step) => (
										<Button
											key={step.label}
											variant={step.primary ? "default" : "outline"}
											onClick={() =>
												step.status
													? changeStatus(step.status)
													: step.kind === "follow_up"
														? run(() => followUp(app.id), "Follow-up logged: the clock restarts")
														: setComposer(step.kind ?? null)
											}
										>
											{step.label}
										</Button>
									))}
								</div>
							)}
							{app.waiting && status === "applied" && (
								<p className="text-xs text-muted-foreground">
									{app.waiting.due === "ghost"
										? `No answer for ${formatAge(app.waiting.days)}. Time to let it go?`
										: app.waiting.due === "follow_up"
											? `Sent ${formatAge(app.waiting.days)} ago, no answer: worth a nudge.`
											: app.waiting.days === 0
												? "Sent today."
												: `Sent ${formatAge(app.waiting.days)} ago.`}
								</p>
							)}
						</section>
					)}

					<div className="animate-rise" style={rise(3)}>
						<Timeline
							applicationId={app.id}
							dateApplied={app.dateApplied}
							events={app.events}
							today={today}
							composer={composer}
							onComposer={setComposer}
						/>
					</div>

					<div className="animate-rise" style={rise(4)}>
						<Notes value={app.notes} onSave={(notes) => patch({ notes })} />
					</div>

					<section aria-labelledby="kyuu-details" className="animate-rise" style={rise(5)}>
						<h2 id="kyuu-details" className="mb-3 text-sm font-medium">
							Details
						</h2>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field
								label="Contact"
								value={app.contact}
								placeholder="Name, email, Telegram…"
								onSave={(contact) => patch({ contact })}
								wide
							/>
							<Field
								label="Location"
								value={app.location}
								onSave={(location) => patch({ location })}
							/>
							<Field label="Salary" value={app.salary} onSave={(salary) => patch({ salary })} />
							<Field label="Source" value={app.source} onSave={(source) => patch({ source })} />
							<Field
								label="Sent on"
								type="date"
								value={app.dateApplied}
								onSave={(dateApplied) => dateApplied && patch({ dateApplied })}
							/>
							<Field
								label="Posting link"
								type="url"
								value={app.jobUrl}
								placeholder="https://…"
								onSave={(jobUrl) => patch({ jobUrl })}
								wide
							/>
						</div>
						{(app.fitVerdict || (app.stackTags?.length ?? 0) > 0 || app.remote != null) && (
							<div className="mt-5 space-y-2 text-sm">
								{app.fitVerdict && <p>{app.fitVerdict}</p>}
								{app.remote != null && (
									<p className="text-muted-foreground">
										{app.remote ? "Remote" : "On-site or hybrid"}
									</p>
								)}
								{app.stackTags && app.stackTags.length > 0 && (
									<ul className="flex flex-wrap gap-1.5">
										{app.stackTags.map((tag) => (
											<li
												key={tag}
												className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted-foreground"
											>
												{tag}
											</li>
										))}
									</ul>
								)}
							</div>
						)}
						{app.resumeFileUrl && (
							<p className="mt-4 text-xs text-muted-foreground">
								Résumé:{" "}
								<a
									href={app.resumeFileUrl}
									target="_blank"
									rel="noopener noreferrer"
									download={app.resumeFileName ?? undefined}
									className="text-foreground underline-offset-2 hover:underline"
								>
									{app.resumeFileName ?? "download"}
								</a>
							</p>
						)}
					</section>
				</div>

				{(app.jobDescription || app.coverLetter) && (
					<aside className="min-w-0 animate-rise lg:sticky lg:top-6 lg:self-start" style={rise(3)}>
						<Tabs defaultValue={app.jobDescription ? "job" : "letter"} className="gap-3">
							<TabsList>
								<TabsTrigger value="job" disabled={!app.jobDescription}>
									Posting
								</TabsTrigger>
								<TabsTrigger value="letter" disabled={!app.coverLetter}>
									Cover letter
								</TabsTrigger>
							</TabsList>
							<TabsContent value="job">
								<LongText text={app.jobDescription} />
							</TabsContent>
							<TabsContent value="letter">
								<LongText text={app.coverLetter} copy="Cover letter" />
							</TabsContent>
						</Tabs>
					</aside>
				)}
			</div>
		</article>
	);
}

type Step = { label: string; status?: Status; kind?: EventKind; primary?: boolean };

/** The next step a click away, by where the application stands. */
function nextSteps(status: Status): Step[] {
	switch (status) {
		case "sourced":
		case "drafted":
			return [{ label: "Mark sent", status: "applied", primary: true }];
		case "applied":
			return [
				{ label: "Book a screening", kind: "screening", primary: true },
				{ label: "Followed up", kind: "follow_up" },
				{ label: "Rejected", status: "rejected" },
			];
		case "hr_screening":
			return [
				{ label: "Book an interview", kind: "interview", primary: true },
				{ label: "Rejected", status: "rejected" },
			];
		case "technical_interview":
			return [
				{ label: "Offer", status: "offer", primary: true },
				{ label: "Another interview", kind: "interview" },
				{ label: "Rejected", status: "rejected" },
			];
		default:
			return [];
	}
}

/** A heading that edits in place: saved on blur or Enter, never left empty. */
function InlineTitle({
	value,
	label,
	className,
	onSave,
}: {
	value: string;
	label: string;
	className?: string;
	onSave: (next: string) => void;
}) {
	const draft = useDraft(value, (next) => {
		const trimmed = next.trim();
		if (trimmed && trimmed !== value) onSave(trimmed);
		else draft.revert();
	});
	return (
		<input
			aria-label={label}
			value={draft.draft}
			maxLength={300}
			onChange={(e) => draft.change(e.target.value)}
			onBlur={draft.flush}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
			}}
			className={cn(
				"-mx-2 block w-[calc(100%+1rem)] truncate rounded-md bg-transparent px-2 py-0.5 outline-none transition-colors hover:bg-surface focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
		/>
	);
}

/** A detail that saves itself on blur (or Enter). Blank clears it. */
function Field({
	label,
	value,
	onSave,
	type = "text",
	placeholder,
	wide = false,
}: {
	label: string;
	value: string | null;
	onSave: (next: string | null) => void;
	type?: "text" | "url" | "date";
	placeholder?: string;
	wide?: boolean;
}) {
	const id = useId();
	const draft = useDraft(value ?? "", (next) => {
		const clean = next.trim() || null;
		if (clean !== (value?.trim() || null)) onSave(clean);
	});
	return (
		<div className={cn("space-y-1.5", wide && "sm:col-span-2")}>
			<Label htmlFor={id} className="text-xs text-muted-foreground">
				{label}
			</Label>
			<Input
				id={id}
				type={type}
				value={draft.draft}
				placeholder={placeholder}
				autoComplete="off"
				onChange={(e) => draft.change(e.target.value)}
				onBlur={draft.flush}
				onKeyDown={(e) => {
					if (e.key === "Enter") e.currentTarget.blur();
				}}
			/>
		</div>
	);
}

function Notes({ value, onSave }: { value: string | null; onSave: (next: string) => void }) {
	const id = useId();
	const draft = useDraft(value ?? "", (next) => {
		if ((next.trim() || null) !== (value?.trim() || null)) onSave(next);
	});
	return (
		<section className="space-y-2">
			<Label htmlFor={id} className="text-sm font-medium">
				Notes
			</Label>
			<textarea
				id={id}
				value={draft.draft}
				maxLength={10_000}
				placeholder="What they said, what to ask, what to remember…"
				onChange={(e) => draft.change(e.target.value)}
				onBlur={draft.flush}
				className={cn(FIELD_TEXTAREA, "min-h-28")}
			/>
		</section>
	);
}

/**
 * Pipeline text arrives hard-wrapped at ~80 columns: single line breaks join into spaces,
 * blank lines stay paragraphs (and list lines stay lines).
 */
function reflow(text: string): string {
	return text.replace(/([^\n])\n(?![\n\-•*\d])/g, "$1 ");
}

function LongText({ text, copy }: { text: string | null; copy?: string }) {
	if (!text) return null;
	return (
		<div className="relative">
			{copy && (
				<Button
					variant="ghost"
					size="sm"
					className="absolute top-1.5 right-1.5 gap-1.5"
					onClick={() =>
						navigator.clipboard
							.writeText(text)
							.then(() => toast.success(`${copy} copied`))
							.catch(() => toast.error("Couldn't copy"))
					}
				>
					<HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
					Copy
				</Button>
			)}
			<div className="max-h-[70vh] overflow-y-auto rounded-lg bg-surface p-4 pr-20 text-sm leading-relaxed whitespace-pre-wrap [scrollbar-width:thin]">
				{reflow(text)}
			</div>
		</div>
	);
}
