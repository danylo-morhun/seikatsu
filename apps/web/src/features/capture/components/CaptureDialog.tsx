"use client";

import { PencilEdit02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { parseNumber } from "@/features/aisha/lib/format";
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
	const [editing, setEditing] = useState(false);
	const { action } = row;
	const { app, title, detail } = describeAction(action, options, today);
	const config = APPS_CONFIG[app];
	const money = action.kind === "expense" || action.kind === "income";
	const categories =
		action.kind === "income" ? options.incomeCategories : options.expenseCategories;
	// Pickers show when something is missing, or while the row is being edited.
	const showMoney = money && (editing || !action.walletId || !action.categoryId);
	const showProject = action.kind === "card" && (editing || !action.projectId);

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
				<div className="flex items-start gap-2">
					<label htmlFor={`${id}-on`} className="block min-w-0 flex-1">
						<span className="block truncate text-sm font-medium">{title}</span>
						<span className="block truncate text-xs text-muted-foreground">{detail}</span>
					</label>
					{row.on && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-8 shrink-0 text-muted-foreground"
							aria-label={editing ? `Done editing ${title}` : `Edit ${title}`}
							aria-pressed={editing}
							disabled={disabled}
							onClick={() => setEditing((v) => !v)}
						>
							<HugeiconsIcon icon={editing ? Tick02Icon : PencilEdit02Icon} className="size-4" />
						</Button>
					)}
				</div>
				{row.on && editing && (
					<Fields action={action} today={today} disabled={disabled} onChange={onChange} />
				)}
				{row.on && showMoney && (
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
				{row.on && showProject && action.kind === "card" && (
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

/** The row's own fields, by kind: what the line said, to fix before saving. */
function Fields({
	action,
	today,
	disabled,
	onChange,
}: {
	action: PlannedAction;
	today: string;
	disabled: boolean;
	onChange: (patch: Partial<PlannedAction>) => void;
}) {
	const date = "date" in action && (
		<Field label="Date">
			<Input
				type="date"
				max={today}
				value={action.date}
				disabled={disabled}
				className="h-9"
				onChange={(e) => e.target.value && onChange({ date: e.target.value })}
			/>
		</Field>
	);
	switch (action.kind) {
		case "expense":
		case "income":
			return (
				<div className="grid grid-cols-2 gap-2">
					<Field label={`Amount, ${action.currency}`}>
						<NumberInput
							value={action.amount}
							disabled={disabled}
							onChange={(amount) => onChange({ amount: amount ?? 0 })}
						/>
					</Field>
					{date}
					<Field label="Description" className="col-span-2">
						<Input
							value={action.description}
							disabled={disabled}
							className="h-9"
							onChange={(e) => onChange({ description: e.target.value })}
						/>
					</Field>
				</div>
			);
		case "want":
			return (
				<div className="grid grid-cols-[1fr_8rem] gap-2">
					<Field label="Name">
						<Input
							value={action.title}
							disabled={disabled}
							className="h-9"
							onChange={(e) => onChange({ title: e.target.value })}
						/>
					</Field>
					<Field label={`Price, ${action.currency}`}>
						<NumberInput
							value={action.price}
							disabled={disabled}
							onChange={(price) => onChange({ price })}
						/>
					</Field>
				</div>
			);
		case "card":
			return (
				<Field label="Title">
					<Input
						value={action.title}
						disabled={disabled}
						className="h-9"
						onChange={(e) => onChange({ title: e.target.value })}
					/>
				</Field>
			);
		case "mileage":
			return (
				<div className="grid grid-cols-2 gap-2">
					<Field label="Odometer, km">
						<NumberInput
							value={action.km}
							integer
							disabled={disabled}
							onChange={(km) => km != null && onChange({ km })}
						/>
					</Field>
					{date}
				</div>
			);
		case "pages":
			return (
				<Field label="Page reached">
					<NumberInput
						value={action.page}
						integer
						disabled={disabled}
						onChange={(page) => page != null && onChange({ page })}
					/>
				</Field>
			);
		case "habit":
			return date;
	}
}

function Field({
	label,
	className,
	children,
}: {
	label: string;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: the control is the child
		<label className={cn("block min-w-0 space-y-1", className)}>
			<span className="block text-xs text-muted-foreground">{label}</span>
			{children}
		</label>
	);
}

/** Typed as text so "12," stays while typing; reports the number once it reads as one. */
function NumberInput({
	value,
	integer,
	disabled,
	onChange,
}: {
	value: number | null;
	integer?: boolean;
	disabled: boolean;
	onChange: (value: number | null) => void;
}) {
	const [text, setText] = useState(value == null ? "" : String(value));
	return (
		<Input
			inputMode={integer ? "numeric" : "decimal"}
			autoComplete="off"
			value={text}
			disabled={disabled}
			className="h-9 font-figures"
			onChange={(e) => {
				setText(e.target.value);
				const n = parseNumber(e.target.value);
				if (n == null) onChange(null);
				else if (!integer || Number.isInteger(n)) onChange(n);
			}}
		/>
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
