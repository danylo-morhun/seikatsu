"use client";

import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import { useDraft } from "@/hooks/useDraft";
import {
	Archive01Icon,
	ArchiveArrowUpIcon,
	Copy01Icon,
	Delete01Icon,
	LinkSquare02Icon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	cn,
} from "@seikatsu/ui";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { formatAge, formatDay, formatWhen } from "../lib/format";
import type { ApplicationPatch } from "../lib/kyuu-schemas";
import { EVENT_LABELS, type EventKind, STATUSES, STATUS_CONFIG, type Status } from "../lib/stages";
import type { ApplicationDetail, KyuuEvent } from "../lib/types";
import { FIELD_TEXTAREA } from "./ApplicationDialog";
import { StatusMark } from "./StatusMark";

export interface SheetActions {
	setStatus: (status: Status) => void;
	edit: () => void;
	logEvent: (kind: EventKind) => void;
	editEvent: (event: KyuuEvent) => void;
	patch: (patch: ApplicationPatch) => void;
	setArchived: (archived: boolean) => void;
	delete: () => void;
}

interface Props {
	/** Null while it loads (with `open`), or after it's gone. */
	application: ApplicationDetail | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	today: string;
	actions: SheetActions;
}

/** One application, everything about it: where it stands, what happened, the posting. */
export function ApplicationSheet({ application, open, onOpenChange, today, actions }: Props) {
	const titleId = useId();
	// Keep showing it while the sheet slides out.
	const last = useRef(application);
	if (application) last.current = application;
	const shown = application ?? (open ? null : last.current);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				aria-labelledby={titleId}
				className="w-full gap-0 text-sm data-[side=right]:w-full sm:max-w-xl data-[side=right]:sm:max-w-xl"
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					(e.currentTarget as HTMLElement | null)?.focus();
				}}
				onCloseAutoFocus={(e) => {
					if (!shown) return;
					const row = document.querySelector<HTMLElement>(`[data-app-id="${shown.id}"]`);
					if (row) {
						e.preventDefault();
						row.focus({ preventScroll: true });
					}
				}}
			>
				<SheetTitle className="sr-only">{shown?.company ?? "Application"}</SheetTitle>
				<SheetDescription className="sr-only">
					Status, timeline, notes and the posting. Notes save as you type.
				</SheetDescription>

				{!shown ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner />
					</div>
				) : (
					<>
						<div className="absolute top-4 right-14 flex items-center gap-1 max-sm:hidden">
							<Button
								variant="ghost"
								size="icon"
								aria-label="Edit"
								aria-keyshortcuts="E"
								onClick={actions.edit}
							>
								<HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4" />
							</Button>
							<SheetMenu application={shown} actions={actions} />
						</div>

						<div className="flex-1 overflow-y-auto px-4 pt-14 pb-10 [scrollbar-width:thin] sm:px-6 sm:pt-16">
							<Detail
								key={shown.id}
								application={shown}
								titleId={titleId}
								today={today}
								actions={actions}
							/>
						</div>

						<div className="flex items-center gap-1 border-t border-rule px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:hidden">
							<Button
								variant="ghost"
								className="gap-1.5 text-muted-foreground"
								onClick={actions.edit}
							>
								<HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4" />
								Edit
							</Button>
							<span className="ml-auto">
								<SheetMenu application={shown} actions={actions} />
							</span>
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}

function SheetMenu({
	application,
	actions,
}: {
	application: ApplicationDetail;
	actions: SheetActions;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Application actions">
					<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuItem onClick={() => actions.setArchived(!application.archived)}>
					<HugeiconsIcon
						icon={application.archived ? ArchiveArrowUpIcon : Archive01Icon}
						className="mr-2 h-4 w-4"
					/>
					{application.archived ? "Restore" : "Archive"}
					<DropdownMenuShortcut>A</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="text-destructive focus:text-destructive"
					onClick={actions.delete}
				>
					<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-4 w-4" />
					Delete…
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** The next step a click away, by where the application stands. */
function nextSteps(status: Status): { label: string; run: (a: SheetActions) => void }[] {
	switch (status) {
		case "sourced":
		case "drafted":
			return [{ label: "Mark sent", run: (a) => a.setStatus("applied") }];
		case "applied":
			return [
				{ label: "Book a screening", run: (a) => a.logEvent("screening") },
				{ label: "Followed up", run: (a) => a.logEvent("follow_up") },
				{ label: "Rejected", run: (a) => a.setStatus("rejected") },
			];
		case "hr_screening":
			return [
				{ label: "Book an interview", run: (a) => a.logEvent("interview") },
				{ label: "Rejected", run: (a) => a.setStatus("rejected") },
			];
		case "technical_interview":
			return [
				{ label: "Book another interview", run: (a) => a.logEvent("interview") },
				{ label: "Offer", run: (a) => a.setStatus("offer") },
				{ label: "Rejected", run: (a) => a.setStatus("rejected") },
			];
		default:
			return [];
	}
}

function Detail({
	application: app,
	titleId,
	today,
	actions,
}: {
	application: ApplicationDetail;
	titleId: string;
	today: string;
	actions: SheetActions;
}) {
	const id = useId();
	const [writingNotes, setWritingNotes] = useState(false);
	const notes = useDraft(app.notes ?? "", (next) => {
		if ((next.trim() || null) !== (app.notes?.trim() || null)) actions.patch({ notes: next });
	});
	const contact = useDraft(app.contact ?? "", (next) => {
		if ((next.trim() || null) !== app.contact) actions.patch({ contact: next });
	});

	const meta = [
		app.location,
		app.remote === true ? "Remote" : app.remote === false ? "On-site or hybrid" : null,
		app.salary,
	].filter(Boolean);
	const steps = nextSteps(app.status);

	return (
		<div className="space-y-9">
			<header className="space-y-3">
				<div>
					<h2 id={titleId} className="text-lg leading-snug font-semibold tracking-tight">
						{app.company}
					</h2>
					<p className="text-muted-foreground">{app.role}</p>
				</div>
				<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
					{app.applyMethod === "auto" && <span>Sent by the pipeline</span>}
					{app.archived && <span>Archived</span>}
				</p>
				{app.fitVerdict && <p className="text-sm">{app.fitVerdict}</p>}
				{meta.length > 0 && <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>}
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
			</header>

			<section aria-label="Where it stands" className="space-y-3">
				<div className="flex flex-wrap items-center gap-2">
					<Select value={app.status} onValueChange={(v) => actions.setStatus(v as Status)}>
						<SelectTrigger aria-label="Status" className="w-44">
							<SelectValue>
								<StatusMark status={app.status} className="text-sm" />
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{STATUSES.map((s) => (
								<SelectItem key={s} value={s}>
									<StatusMark status={s} className="text-sm" />
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{steps.map((step) => (
						<Button key={step.label} variant="outline" onClick={() => step.run(actions)}>
							{step.label}
						</Button>
					))}
				</div>
				{app.waiting && (
					<p className="text-xs text-muted-foreground">
						{app.waiting.due === "ghost"
							? `No answer for ${formatAge(app.waiting.days)}. Time to let it go?`
							: app.waiting.due === "follow_up"
								? `Sent ${formatAge(app.waiting.days)} ago with no answer: worth a nudge.`
								: `Sent ${app.waiting.days === 0 ? "today" : `${formatAge(app.waiting.days)} ago`}.`}
					</p>
				)}
			</section>

			<section aria-labelledby={`${id}-timeline`} className="space-y-3">
				<h3 id={`${id}-timeline`} className="text-sm font-medium">
					Timeline
				</h3>
				<ol className="relative space-y-4 border-l border-rule pl-4">
					<TimelineItem label="Sent" when={formatDay(app.dateApplied, today)} />
					{app.events.map((e) => (
						<li key={e.id} className="relative">
							<button
								type="button"
								onClick={() => actions.editEvent(e)}
								className="-mx-2 -my-1 block w-[calc(100%+1rem)] rounded-md px-2 py-1 text-left outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
							>
								<TimelineBody
									label={EVENT_LABELS[e.kind]}
									when={
										e.date
											? e.date >= today && (e.kind === "screening" || e.kind === "interview")
												? formatWhen(e.date, e.time, today)
												: formatDay(e.date, today)
											: "Day unknown"
									}
									ahead={!!e.date && e.date > today}
									note={e.note}
								/>
							</button>
						</li>
					))}
				</ol>
				<QuietAdd
					onClick={() => actions.logEvent(app.status === "applied" ? "screening" : "interview")}
				>
					Log an update
				</QuietAdd>
			</section>

			<section className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor={`${id}-contact`}>Contact</Label>
					<Input
						id={`${id}-contact`}
						value={contact.draft}
						maxLength={500}
						autoComplete="off"
						placeholder="Recruiter's name, email, Telegram…"
						onChange={(e) => contact.change(e.target.value)}
						onBlur={contact.flush}
						onKeyDown={(e) => {
							if (e.key === "Enter") e.currentTarget.blur();
						}}
					/>
				</div>
				{!notes.draft && !writingNotes ? (
					<QuietAdd onClick={() => setWritingNotes(true)}>Add notes</QuietAdd>
				) : (
					<div className="animate-swap space-y-2">
						<Label htmlFor={`${id}-notes`}>Notes</Label>
						<textarea
							id={`${id}-notes`}
							value={notes.draft}
							maxLength={10_000}
							autoFocus={writingNotes && !app.notes}
							onChange={(e) => notes.change(e.target.value)}
							onFocus={() => setWritingNotes(true)}
							onBlur={() => {
								notes.flush();
								setWritingNotes(false);
							}}
							className={cn(FIELD_TEXTAREA, "min-h-24")}
						/>
					</div>
				)}
				{app.resumeFileUrl && (
					<p className="text-xs text-muted-foreground">
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

			{(app.jobDescription || app.coverLetter) && (
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
			)}
		</div>
	);
}

function TimelineItem({ label, when }: { label: string; when: string }) {
	return (
		<li className="relative">
			<TimelineBody label={label} when={when} ahead={false} note={null} />
		</li>
	);
}

function TimelineBody({
	label,
	when,
	ahead,
	note,
}: {
	label: string;
	when: string;
	ahead: boolean;
	note: string | null;
}) {
	return (
		<>
			<span
				aria-hidden
				className={cn(
					"absolute -left-[calc(1rem+4.5px)] top-1.5 size-2 rounded-full",
					ahead ? "bg-primary" : "bg-muted-foreground/40",
				)}
			/>
			<span className="flex items-baseline justify-between gap-3">
				<span className={cn("font-medium", ahead && "text-primary")}>{label}</span>
				<span className="shrink-0 text-xs text-muted-foreground">{when}</span>
			</span>
			{note && (
				<span className="mt-0.5 block whitespace-pre-wrap text-muted-foreground">{note}</span>
			)}
		</>
	);
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
			<div className="max-h-[50vh] overflow-y-auto rounded-md bg-surface p-3 pr-20 text-sm leading-relaxed whitespace-pre-wrap [scrollbar-width:thin]">
				{text}
			</div>
		</div>
	);
}
