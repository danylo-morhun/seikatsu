"use client";

import { Cancel01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	cn,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import { FieldError, FOOTER } from "@/features/aisha/components/DialogParts";
import {
	addLink,
	archiveGoal,
	createGoal,
	deleteGoal,
	removeLink,
	updateGoal,
} from "@/features/goals/actions/goals";
import type { LinkOptions } from "@/features/goals/lib/data";
import { LINK_APPS, LINK_KINDS, type LinkKind, type LinkView } from "@/features/goals/lib/progress";
import { Seal } from "@/features/home/components/Line";

export type GoalCardData = {
	id: string;
	name: string;
	note: string | null;
	targetDate: string | null;
	/** "14 Feb 2027 · in 3 months". */
	when: string | null;
	progress: number | null;
	links: { id: string; kind: LinkKind; view: LinkView }[];
};

const failed = "Couldn't save. Check your connection.";

/** A thin bar for a share from 0 to 1. */
function Bar({ ratio, className }: { ratio: number; className?: string }) {
	return (
		<div aria-hidden className={cn("h-1 overflow-hidden rounded-full bg-surface-2", className)}>
			<div
				className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
				style={{ width: `${Math.round(ratio * 100)}%` }}
			/>
		</div>
	);
}

/** The goals' seal: 志, "aspiration", in the shell's ink. */
function GoalSeal() {
	return (
		<span
			aria-hidden
			className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground/10 text-[13px] font-semibold"
		>
			志
		</span>
	);
}

export function GoalCard({
	goal,
	options,
	index,
}: {
	goal: GoalCardData;
	options: LinkOptions;
	index: number;
}) {
	const [editing, setEditing] = useState(false);
	const [linking, setLinking] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [, startTransition] = useTransition();
	const percent = goal.progress != null ? Math.round(goal.progress * 100) : null;

	function run(action: () => Promise<{ error: string } | { success: true }>) {
		startTransition(async () => {
			const result = await action().catch(() => ({ error: failed }));
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<li
			aria-label={goal.name}
			className="group-card min-w-0 animate-rise space-y-4"
			style={{ "--i": index } as CSSProperties}
		>
			<div className="flex items-start gap-3">
				<GoalSeal />
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-base font-semibold">{goal.name}</h2>
					<p className="truncate text-xs text-muted-foreground">
						{[goal.when, percent != null && `${percent}% there`].filter(Boolean).join(" · ") ||
							"Open-ended"}
					</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8 shrink-0 text-muted-foreground"
							aria-label={`${goal.name}: more`}
						>
							<HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => run(() => archiveGoal(goal.id))}>
							Reached, put away
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onSelect={() => setDeleting(true)}
						>
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			{percent != null && <Bar ratio={goal.progress ?? 0} />}
			{goal.note && <p className="text-sm text-muted-foreground">{goal.note}</p>}

			{goal.links.length > 0 && (
				<ul aria-label={`${goal.name}: linked`} className="inset-group">
					{goal.links.map((l) => (
						<li key={l.id} className="flex min-h-14 items-center gap-3 py-2">
							<Seal href={l.view.app} />
							<Link href={l.view.href} prefetch className="group min-w-0 flex-1 outline-none">
								<span className="block truncate text-sm font-medium group-hover:underline group-focus-visible:underline">
									{l.view.title}
								</span>
								<span className="block truncate text-xs text-muted-foreground">
									{l.view.detail}
								</span>
								{l.view.ratio != null && <Bar ratio={l.view.ratio} className="mt-1.5" />}
							</Link>
							<Button
								variant="ghost"
								size="icon"
								className="size-8 shrink-0 text-muted-foreground"
								aria-label={`Unlink ${l.view.title}`}
								onClick={() => run(() => removeLink(l.id))}
							>
								<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
							</Button>
						</li>
					))}
				</ul>
			)}
			<QuietAdd onClick={() => setLinking(true)}>Link a fund, project, habit…</QuietAdd>

			<GoalDialog open={editing} onOpenChange={setEditing} goal={goal} />
			<LinkDialog
				open={linking}
				onOpenChange={setLinking}
				goalId={goal.id}
				goalName={goal.name}
				options={options}
				linked={goal.links}
			/>
			<ConfirmDelete
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete "${goal.name}"?`}
				description="The goal goes; what it links stays in its apps. To keep it for the record, use Reached instead."
				onConfirm={async () => {
					const result = await deleteGoal(goal.id).catch(() => ({ error: failed }));
					if ("error" in result) toast.error(result.error);
				}}
			/>
		</li>
	);
}

export function NewGoal() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button onClick={() => setOpen(true)}>New goal</Button>
			<GoalDialog open={open} onOpenChange={setOpen} />
		</>
	);
}

function GoalDialog({
	open,
	onOpenChange,
	goal,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	goal?: GoalCardData;
}) {
	const id = useId();
	const [name, setName] = useState("");
	const [targetDate, setTargetDate] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();

	useEffect(() => {
		if (!open) return;
		setName(goal?.name ?? "");
		setTargetDate(goal?.targetDate ?? "");
		setNote(goal?.note ?? "");
		setError(null);
	}, [open, goal]);

	function submit(e: React.FormEvent) {
		e.preventDefault();
		startSave(async () => {
			const input = { name, targetDate: targetDate || null, note: note || null };
			const result = await (goal ? updateGoal(goal.id, input) : createGoal(input)).catch(() => ({
				error: failed,
			}));
			if ("error" in result) {
				setError(result.error);
				return;
			}
			onOpenChange(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{goal ? "Edit goal" : "New goal"}</DialogTitle>
					<DialogDescription>
						What it's for, and when. Link what moves it forward once it's made.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-name`}>Name</Label>
						<Input
							id={`${id}-name`}
							autoFocus
							autoComplete="off"
							placeholder="Tatry in February"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${id}-date`}>By</Label>
						<Input
							id={`${id}-date`}
							type="date"
							value={targetDate}
							onChange={(e) => setTargetDate(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${id}-note`}>Why</Label>
						<Input
							id={`${id}-note`}
							autoComplete="off"
							placeholder="Optional"
							value={note}
							onChange={(e) => setNote(e.target.value)}
						/>
					</div>
					{error && <FieldError>{error}</FieldError>}
					<div className={FOOTER}>
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							disabled={isSaving}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="gap-1.5 max-sm:flex-1"
							disabled={isSaving || !name.trim()}
						>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : goal ? "Save" : "Create goal"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function LinkDialog({
	open,
	onOpenChange,
	goalId,
	goalName,
	options,
	linked,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	goalId: string;
	goalName: string;
	options: LinkOptions;
	linked: GoalCardData["links"];
}) {
	const id = useId();
	const [kind, setKind] = useState<LinkKind>("fund");
	const [refId, setRefId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();
	const hasJobs = linked.some((l) => l.kind === "jobs");
	const choices = kind === "jobs" ? [] : options[kind];

	useEffect(() => {
		if (!open) return;
		setKind("fund");
		setRefId(null);
		setError(null);
	}, [open]);

	const ready = kind === "jobs" ? !hasJobs : refId != null;

	function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!ready) return;
		startSave(async () => {
			const result = await addLink(goalId, {
				kind,
				refId: kind === "jobs" ? null : refId,
			}).catch(() => ({ error: failed }));
			if ("error" in result) {
				setError(result.error);
				return;
			}
			onOpenChange(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Link to {goalName}</DialogTitle>
					<DialogDescription>
						Something whole from one of the apps; its progress counts toward the goal.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit} className="space-y-4">
					<fieldset className="space-y-2">
						<legend className="mb-2 text-sm font-medium leading-none">From</legend>
						<div className="grid grid-cols-3 gap-1.5">
							{LINK_KINDS.map((k) => (
								<button
									key={k}
									type="button"
									aria-pressed={kind === k}
									onClick={() => {
										setKind(k);
										setRefId(null);
										setError(null);
									}}
									className={cn(
										"flex h-10 items-center gap-2 rounded-button px-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
										kind === k
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-surface-2 hover:text-foreground",
									)}
								>
									<span className="truncate">{LINK_APPS[k].label}</span>
								</button>
							))}
						</div>
					</fieldset>

					{kind === "jobs" ? (
						<p className="text-sm text-muted-foreground">
							{hasJobs
								? "The job search is already part of this goal."
								: "The whole Kyuu search: applications sent and answers in the last 30 days."}
						</p>
					) : choices.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Nothing to link yet: make one in {LINK_APPS[kind].app.slice(1)} first.
						</p>
					) : (
						<div className="space-y-2">
							<Label htmlFor={`${id}-ref`}>{LINK_APPS[kind].label}</Label>
							<Select value={refId ?? undefined} onValueChange={setRefId}>
								<SelectTrigger id={`${id}-ref`} className="w-full">
									<SelectValue placeholder={`Pick a ${LINK_APPS[kind].label.toLowerCase()}`} />
								</SelectTrigger>
								<SelectContent>
									{choices.map((c) => (
										<SelectItem key={c.id} value={c.id}>
											{c.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{error && <FieldError>{error}</FieldError>}
					<div className={FOOTER}>
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							disabled={isSaving}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" className="gap-1.5 max-sm:flex-1" disabled={isSaving || !ready}>
							{isSaving && <Spinner />}
							{isSaving ? "Linking…" : "Link"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
