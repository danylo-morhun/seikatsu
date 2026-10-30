"use client";

import { useDraft } from "@/hooks/useDraft";
import {
	Archive01Icon,
	ArchiveArrowUpIcon,
	ArrowLeft01Icon,
	ArrowRight01Icon,
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
	cn,
} from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { patchApplication } from "../actions/applications";
import { followUp, setArchived, setStatus } from "../actions/progress";
import { COUNTRY_CODES, countryName, parseCountry } from "../lib/country";
import { requestDeleteApplication } from "../lib/events";
import { formatAge } from "../lib/format";
import type { ApplicationPatch } from "../lib/kyuu-schemas";
import { type EventKind, STATUSES, type Status } from "../lib/stages";
import type { ApplicationDetail } from "../lib/types";
import { FIELD_TEXTAREA } from "./ApplicationDialog";
import { CountryFlag } from "./CountryFlag";
import { StatusMark } from "./StatusMark";
import { Timeline } from "./Timeline";

const FAILED = { error: "Couldn't save. Check your connection." } as const;
const rise = (i: number) => ({ "--i": i }) as CSSProperties;

type Step = { label: string; status?: Status; kind?: EventKind };

/** The one next step for where it stands; the rest live in the status menu and ⋯. */
const COUNTRY_LIST_ID = "kyuu-countries";

function nextStep(status: Status): Step | null {
	switch (status) {
		case "sourced":
		case "drafted":
			return { label: "Mark sent", status: "applied" };
		case "applied":
			return { label: "Book a screening", kind: "screening" };
		case "hr_screening":
			return { label: "Book an interview", kind: "interview" };
		case "technical_interview":
			return { label: "Offer", status: "offer" };
		default:
			return null;
	}
}

/** One application, read like a document: where it stands, what happened, the facts, the posting. */
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
	const step = nextStep(status);
	const waiting = status === "applied" ? app.waiting : null;

	return (
		<article className="mx-auto max-w-2xl">
			<Link
				href="/kyuu"
				prefetch
				className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden className="size-4" />
				Applications
			</Link>

			<header className="mt-6 animate-rise" style={rise(0)}>
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0 flex-1">
						<InlineText
							value={app.company}
							label="Company"
							required
							className="text-2xl leading-tight font-semibold tracking-tight"
							onSave={(company) => patch({ company })}
						/>
						<InlineText
							value={app.role}
							label="Role"
							required
							className="mt-0.5 text-base text-muted-foreground"
							onSave={(role) => patch({ role })}
						/>
					</div>
					<StatusMenu status={status} onChange={changeStatus} />
				</div>

				<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
					<p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
						{app.jobUrl && (
							<>
								<a
									href={app.jobUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 rounded-sm text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
								>
									Posting
									<HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5" />
								</a>
								<span aria-hidden>·</span>
							</>
						)}
						{app.source && (
							<>
								<span>{app.source}</span>
								<span aria-hidden>·</span>
							</>
						)}
						<span>{app.applyMethod === "auto" ? "sent by the pipeline" : "sent by hand"}</span>
						{app.archived && (
							<>
								<span aria-hidden>·</span>
								<span className="text-foreground">archived</span>
							</>
						)}
					</p>
					<div className="flex items-center gap-1">
						{step && (
							<Button
								className="gap-1.5"
								onClick={() =>
									step.status ? changeStatus(step.status) : setComposer(step.kind ?? null)
								}
							>
								{step.label}
								<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
							</Button>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" aria-label="More actions">
									<HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								{status === "applied" && (
									<DropdownMenuItem
										onClick={() =>
											run(() => followUp(app.id), "Follow-up logged: the clock restarts")
										}
									>
										Followed up
									</DropdownMenuItem>
								)}
								<DropdownMenuItem onClick={() => setComposer("interview")}>
									Book an interview
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => changeStatus("rejected")}>
									Rejected
								</DropdownMenuItem>
								<DropdownMenuSeparator />
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
				</div>

				{waiting && (
					<p className="mt-3 text-sm text-muted-foreground">
						{waiting.due === "ghost"
							? `No answer for ${formatAge(waiting.days)}. Time to let it go?`
							: waiting.due === "follow_up"
								? `Sent ${formatAge(waiting.days)} ago with no answer: worth a nudge.`
								: waiting.days === 0
									? "Sent today."
									: `Sent ${formatAge(waiting.days)} ago.`}
					</p>
				)}
			</header>

			<Section title="Timeline" index={1}>
				<Timeline
					applicationId={app.id}
					dateApplied={app.dateApplied}
					events={app.events}
					today={today}
					composer={composer}
					onComposer={setComposer}
				/>
			</Section>

			<Section title="Notes" index={2}>
				<Notes value={app.notes} onSave={(notes) => patch({ notes })} />
			</Section>

			<Section title="Details" index={3}>
				<dl className="inset-group">
					<Detail
						label="Contact"
						value={app.contact}
						placeholder="Name, email, Telegram"
						onSave={(contact) => patch({ contact })}
					/>
					<Detail
						label="Location"
						value={app.location}
						onSave={(location) => patch({ location })}
					/>
					<Detail
						label="Country"
						value={app.country ? countryName(app.country) : null}
						list={COUNTRY_LIST_ID}
						leading={app.country ? <CountryFlag code={app.country} /> : undefined}
						onSave={(text) => {
							if (!text) return patch({ country: null });
							const country = parseCountry(text);
							if (country) patch({ country });
							else toast.error(`No country called “${text}”`);
						}}
					/>
					<Detail label="Salary" value={app.salary} onSave={(salary) => patch({ salary })} />
					<Detail label="Source" value={app.source} onSave={(source) => patch({ source })} />
					<Detail
						label="Sent on"
						type="date"
						value={app.dateApplied}
						onSave={(dateApplied) => dateApplied && patch({ dateApplied })}
					/>
					<Detail
						label="Posting link"
						type="url"
						value={app.jobUrl}
						placeholder="https://…"
						onSave={(jobUrl) => patch({ jobUrl })}
					/>
					{app.remote != null && (
						<Row label="Work">{app.remote ? "Remote" : "On-site or hybrid"}</Row>
					)}
					{app.stackTags && app.stackTags.length > 0 && (
						<Row label="Stack">
							<span className="flex flex-wrap gap-1.5">
								{app.stackTags.map((tag) => (
									<span key={tag} className="rounded-md bg-surface px-2 py-0.5 text-xs">
										{tag}
									</span>
								))}
							</span>
						</Row>
					)}
					{app.fitVerdict && <Row label="Fit">{app.fitVerdict}</Row>}
					{app.resumeFileUrl && (
						<Row label="Résumé">
							<a
								href={app.resumeFileUrl}
								target="_blank"
								rel="noopener noreferrer"
								download={app.resumeFileName ?? undefined}
								className="underline-offset-4 hover:underline"
							>
								{app.resumeFileName ?? "Download"}
							</a>
						</Row>
					)}
				</dl>
				<datalist id={COUNTRY_LIST_ID}>
					{COUNTRY_CODES.map((code) => (
						<option key={code} value={countryName(code)} />
					))}
				</datalist>
			</Section>

			{(app.jobDescription || app.coverLetter) && (
				<div className="mt-10 animate-rise space-y-1 border-t border-rule pt-4" style={rise(4)}>
					{app.jobDescription && <Fold title="Posting" text={app.jobDescription} />}
					{app.coverLetter && <Fold title="Cover letter" text={app.coverLetter} copy />}
				</div>
			)}
		</article>
	);
}

function Section({
	title,
	index,
	children,
}: {
	title: string;
	index: number;
	children: React.ReactNode;
}) {
	const id = useId();
	return (
		<section
			aria-labelledby={id}
			className="mt-10 animate-rise border-t border-rule pt-6"
			style={rise(index)}
		>
			<h2 id={id} className="mb-4 text-sm font-medium text-muted-foreground">
				{title}
			</h2>
			{children}
		</section>
	);
}

function StatusMenu({ status, onChange }: { status: Status; onChange: (s: Status) => void }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="Status"
					className="flex shrink-0 items-center rounded-md px-2.5 py-1.5 outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
				>
					<StatusMark status={status} className="text-sm" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuRadioGroup value={status} onValueChange={(v) => onChange(v as Status)}>
					{STATUSES.map((s) => (
						<DropdownMenuRadioItem key={s} value={s}>
							<StatusMark status={s} />
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Text that reads as text and edits in place: saved on blur or Enter, never left empty. */
function InlineText({
	value,
	label,
	className,
	required = false,
	onSave,
}: {
	value: string;
	label: string;
	className?: string;
	required?: boolean;
	onSave: (next: string) => void;
}) {
	const draft = useDraft(value, (next) => {
		const trimmed = next.trim();
		if (trimmed === value.trim()) return;
		if (required && !trimmed) draft.revert();
		else onSave(trimmed);
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
				"-mx-1.5 block w-[calc(100%+0.75rem)] truncate rounded-md bg-transparent px-1.5 outline-none transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
		/>
	);
}

/** A detail row: label, and a value that edits in place. Blank clears it. */
function Detail({
	label,
	value,
	onSave,
	type = "text",
	placeholder = "—",
	list,
	leading,
}: {
	label: string;
	value: string | null;
	onSave: (next: string | null) => void;
	type?: "text" | "url" | "date";
	placeholder?: string;
	/** A datalist to suggest from. */
	list?: string;
	/** Shown inside the field, before the value (a flag). */
	leading?: React.ReactNode;
}) {
	const id = useId();
	const draft = useDraft(value ?? "", (next) => {
		const clean = next.trim() || null;
		if (clean !== (value?.trim() || null)) onSave(clean);
	});
	return (
		<div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-4 py-1.5">
			<dt>
				<label htmlFor={id} className="text-sm text-muted-foreground">
					{label}
				</label>
			</dt>
			<dd className="relative min-w-0">
				{leading && (
					<span className="pointer-events-none absolute top-1/2 left-0 flex -translate-y-1/2">
						{leading}
					</span>
				)}
				<input
					id={id}
					type={type}
					list={list}
					value={draft.draft}
					placeholder={placeholder}
					autoComplete="off"
					onChange={(e) => draft.change(e.target.value)}
					onBlur={draft.flush}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
					}}
					className={cn(
						"-mx-2 h-8 w-[calc(100%+1rem)] truncate rounded-md bg-transparent px-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 hover:bg-surface focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-calendar-picker-indicator]:opacity-40",
						leading && "pl-9",
					)}
				/>
			</dd>
		</div>
	);
}

/** A detail that's only read (written by the pipeline). */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-4 py-2.5">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="min-w-0 text-sm">{children}</dd>
		</div>
	);
}

/** Notes read as text; a click turns them into a field, saved on blur. */
function Notes({ value, onSave }: { value: string | null; onSave: (next: string) => void }) {
	const [editing, setEditing] = useState(false);
	const draft = useDraft(value ?? "", (next) => {
		if ((next.trim() || null) !== (value?.trim() || null)) onSave(next);
	});

	if (!editing)
		return (
			<button
				type="button"
				onClick={() => setEditing(true)}
				className={cn(
					"-mx-2 block w-[calc(100%+1rem)] rounded-md px-2 py-1.5 text-left text-sm whitespace-pre-wrap outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring",
					draft.draft ? "leading-relaxed" : "text-muted-foreground/60",
				)}
			>
				{draft.draft || "Add a note: what they said, what to ask, what to remember…"}
			</button>
		);
	return (
		<textarea
			aria-label="Notes"
			value={draft.draft}
			maxLength={10_000}
			autoFocus
			onChange={(e) => draft.change(e.target.value)}
			onBlur={() => {
				draft.flush();
				setEditing(false);
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") e.currentTarget.blur();
			}}
			className={cn(FIELD_TEXTAREA, "min-h-28 leading-relaxed")}
		/>
	);
}

/**
 * Pipeline text arrives hard-wrapped at ~80 columns: single line breaks join into spaces,
 * blank lines stay paragraphs (and list lines stay lines).
 */
function reflow(text: string): string {
	return text.replace(/([^\n])\n(?![\n\-•*\d])/g, "$1 ");
}

/** The posting or the cover letter: folded until wanted. */
function Fold({ title, text, copy = false }: { title: string; text: string; copy?: boolean }) {
	const [open, setOpen] = useState(false);
	const id = useId();
	return (
		<section>
			<div className="flex items-center justify-between gap-3">
				<button
					type="button"
					aria-expanded={open}
					aria-controls={id}
					onClick={() => setOpen(!open)}
					className="-mx-2 flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				>
					<HugeiconsIcon
						icon={ArrowRight01Icon}
						className={cn(
							"size-4 transition-transform duration-200 ease-out motion-reduce:transition-none",
							open && "rotate-90",
						)}
					/>
					{title}
				</button>
				{copy && (
					<Button
						variant="ghost"
						size="sm"
						className="gap-1.5 text-muted-foreground"
						onClick={() =>
							navigator.clipboard
								.writeText(text)
								.then(() => toast.success(`${title} copied`))
								.catch(() => toast.error("Couldn't copy"))
						}
					>
						<HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
						Copy
					</Button>
				)}
			</div>
			{open && (
				<div
					id={id}
					className="animate-swap pt-2 pb-6 pl-6 text-sm leading-relaxed whitespace-pre-wrap text-foreground/85"
				>
					{reflow(text)}
				</div>
			)}
		</section>
	);
}
