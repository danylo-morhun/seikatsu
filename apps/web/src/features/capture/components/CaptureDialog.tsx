"use client";

import {
	Button,
	Checkbox,
	cn,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { FieldError, FOOTER } from "@/features/aisha/components/DialogParts";
import { type CapturePlan, parseCapture } from "@/features/capture/actions/parse";
import { applyAction } from "@/features/capture/lib/apply";
import { describeAction } from "@/features/capture/lib/describe";
import { isReady, type PlannedAction } from "@/features/capture/lib/plan";
import { readCaptureMemory } from "@/features/kuroji/lib/capture-memory";
import { APPS_CONFIG } from "@/lib/app-themes";

const EXAMPLES = "бенз 240 zł, 84 500 км · хочу Kindle · был в зале · 1984 до 52";

type Row = { action: PlannedAction; on: boolean };

/** One line in, the actions it means out; nothing is saved until the user says so. */
export function CaptureDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const id = useId();
	const [text, setText] = useState("");
	const [plan, setPlan] = useState<CapturePlan | null>(null);
	const [rows, setRows] = useState<Row[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isReading, startRead] = useTransition();
	const [isSaving, startSave] = useTransition();
	const busy = isReading || isSaving;

	useEffect(() => {
		if (open) return;
		// Closed: start fresh next time.
		setText("");
		setPlan(null);
		setRows([]);
		setError(null);
	}, [open]);

	function read(e: React.FormEvent) {
		e.preventDefault();
		if (!text.trim()) return;
		setError(null);
		startRead(async () => {
			const result = await parseCapture(text).catch(() => ({
				error: "Couldn't reach seikatsu. Check your connection.",
			}));
			if ("error" in result) {
				setError(result.error);
				return;
			}
			const memory = readCaptureMemory(result.data.workspaceId);
			const owned = (wallet: string | undefined) =>
				result.data.options.wallets.some((w) => w.id === wallet) ? wallet : undefined;
			setPlan(result.data);
			setRows(
				result.data.actions.map((action) => ({
					// The wallet the Kuroji form last paid from, when the line named none.
					action:
						(action.kind === "expense" || action.kind === "income") && !action.walletId
							? { ...action, walletId: owned(memory.wallet?.[action.kind]) ?? null }
							: action,
					on: true,
				})),
			);
			if (result.data.actions.length === 0 && result.data.skipped.length === 0)
				setError("Nothing to save in that. Try naming an amount, a task or a habit.");
		});
	}

	const chosen = rows.filter((r) => r.on);
	const ready = chosen.length > 0 && chosen.every((r) => isReady(r.action));

	function save() {
		if (!plan || !ready) return;
		startSave(async () => {
			const columns = new Map(plan.options.projects.map((p) => [p.id, p.columnId]));
			const results = await Promise.all(
				chosen.map(async (r) => ({
					row: r,
					result: await applyAction(r.action, {
						workspaceId: plan.workspaceId,
						columnOf: (projectId) => columns.get(projectId),
					}).catch(() => ({ error: "Couldn't save. Check your connection." })),
				})),
			);
			const failed = results.filter((r) => "error" in r.result);
			const queued = results.some((r) => "queued" in r.result);
			if (failed.length === 0) {
				toast.success(
					queued
						? "Saved on this device. It syncs when you're back online."
						: `Saved ${results.length === 1 ? describeAction(chosen[0].action, plan.options, plan.today).title : `${results.length} things`}`,
				);
				onOpenChange(false);
				return;
			}
			// Keep only what didn't save, so Save again doesn't repeat the rest.
			const left = new Set(failed.map((f) => f.row.action.key));
			setRows((prev) => prev.filter((r) => left.has(r.action.key)));
			const first = failed[0].result as { error: string };
			setError(
				`${describeAction(failed[0].row.action, plan.options, plan.today).title}: ${first.error}${failed.length > 1 ? ` (and ${failed.length - 1} more)` : ""}`,
			);
		});
	}

	function update(key: string, patch: Partial<PlannedAction>) {
		setRows((prev) =>
			prev.map((r) =>
				r.action.key === key ? { ...r, action: { ...r.action, ...patch } as PlannedAction } : r,
			),
		);
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className="max-sm:flex max-sm:flex-col sm:max-w-lg"
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					document.getElementById(`${id}-text`)?.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle>Capture</DialogTitle>
					<DialogDescription>
						One line about what happened. It goes to the right app, after you check it.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={read} className="flex gap-2">
					<Input
						id={`${id}-text`}
						aria-label="What happened"
						autoComplete="off"
						placeholder={EXAMPLES}
						className="h-11 flex-1"
						value={text}
						disabled={isSaving}
						onChange={(e) => {
							setText(e.target.value);
							setError(null);
						}}
					/>
					<Button
						type="submit"
						variant={plan ? "outline" : "default"}
						className="h-11 gap-1.5"
						disabled={busy || !text.trim()}
					>
						{isReading && <Spinner />}
						{isReading ? "Reading…" : plan ? "Read again" : "Read"}
					</Button>
				</form>

				{plan && rows.length > 0 && (
					<ul aria-label="What it will save" className="inset-group">
						{rows.map((row) => (
							<ActionRow
								key={row.action.key}
								row={row}
								options={plan.options}
								today={plan.today}
								disabled={isSaving}
								onToggle={(on) =>
									setRows((prev) =>
										prev.map((r) => (r.action.key === row.action.key ? { ...r, on } : r)),
									)
								}
								onChange={(patch) => update(row.action.key, patch)}
							/>
						))}
					</ul>
				)}

				{plan && plan.skipped.length > 0 && (
					<ul aria-label="Left out" className="space-y-1 text-xs text-muted-foreground">
						{plan.skipped.map((reason) => (
							<li key={reason}>Left out: {reason}</li>
						))}
					</ul>
				)}

				{isReading && (
					<p role="status" className="text-xs text-muted-foreground">
						Reading… this takes 15–20 seconds.
					</p>
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
					<Button
						type="button"
						className="gap-1.5 max-sm:flex-1"
						disabled={!ready || busy}
						onClick={save}
					>
						{isSaving && <Spinner />}
						{isSaving ? "Saving…" : chosen.length > 1 ? `Save ${chosen.length}` : "Save"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ActionRow({
	row,
	options,
	today,
	disabled,
	onToggle,
	onChange,
}: {
	row: Row;
	options: CapturePlan["options"];
	today: string;
	disabled: boolean;
	onToggle: (on: boolean) => void;
	onChange: (patch: Partial<PlannedAction>) => void;
}) {
	const id = useId();
	const { action } = row;
	const { app, title, detail } = describeAction(action, options, today);
	const config = APPS_CONFIG[app];
	const money = action.kind === "expense" || action.kind === "income";
	const categories =
		action.kind === "income" ? options.incomeCategories : options.expenseCategories;

	return (
		<li className="flex gap-3 py-3">
			<Checkbox
				id={`${id}-on`}
				checked={row.on}
				disabled={disabled}
				onCheckedChange={(v) => onToggle(v === true)}
				className="mt-1.5"
				aria-label={`Save: ${title}`}
			/>
			<span
				aria-hidden
				className={cn(
					config.theme,
					"mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[13px] font-semibold text-primary",
				)}
			>
				{config.kanji}
			</span>
			<div className={cn("min-w-0 flex-1 space-y-2", !row.on && "opacity-50")}>
				<label htmlFor={`${id}-on`} className="block">
					<span className="block truncate text-sm font-medium">{title}</span>
					<span className="block truncate text-xs text-muted-foreground">{detail}</span>
				</label>
				{row.on && money && (
					<div className="grid grid-cols-2 gap-2">
						<Pick
							label={action.kind === "income" ? "To wallet" : "From wallet"}
							value={action.walletId}
							items={options.wallets.map((w) => ({ id: w.id, name: `${w.name} · ${w.currency}` }))}
							disabled={disabled}
							onChange={(walletId) => onChange({ walletId })}
						/>
						<Pick
							label="Category"
							value={action.categoryId}
							items={categories}
							disabled={disabled}
							onChange={(categoryId) => onChange({ categoryId })}
						/>
					</div>
				)}
				{row.on && action.kind === "card" && (
					<Pick
						label="Project"
						value={action.projectId}
						items={options.projects}
						disabled={disabled}
						onChange={(projectId) => onChange({ projectId })}
					/>
				)}
			</div>
		</li>
	);
}

function Pick({
	label,
	value,
	items,
	disabled,
	onChange,
}: {
	label: string;
	value: string | null;
	items: { id: string; name: string }[];
	disabled: boolean;
	onChange: (id: string) => void;
}) {
	return (
		<Select value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
			<SelectTrigger
				aria-label={label}
				className={cn(
					"h-9 w-full min-w-0",
					!value && "border-destructive/60 text-muted-foreground",
				)}
			>
				<SelectValue placeholder={label} />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item.id} value={item.id}>
						{item.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
