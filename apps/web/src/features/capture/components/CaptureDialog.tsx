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
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { FieldError, FOOTER } from "@/features/aisha/components/DialogParts";
import { parseNumber } from "@/features/aisha/lib/format";
import { type CapturePlan, parseCapture } from "@/features/capture/actions/parse";
import { applyAction } from "@/features/capture/lib/apply";
import { describeAction } from "@/features/capture/lib/describe";
import { isReady, type PlannedAction, withWallet } from "@/features/capture/lib/plan";
import { CurrencySelect, Toggle } from "@/features/hoshii/components/Parts";
import { LazyAddTransactionModal } from "@/features/kuroji/components/LazyAddTransactionModal";
import { readCaptureMemory } from "@/features/kuroji/lib/capture-memory";
import type { AddTransactionFormValues } from "@/features/kuroji/lib/transaction-schema";
import { PRIORITIES, PRIORITY_CONFIG, type Priority } from "@/features/seiryu/lib/constants";
import { APPS_CONFIG } from "@/lib/app-themes";

type Row = { action: PlannedAction; on: boolean };

/** One line in, the actions it means out; nothing is saved until the user says so. */
export function CaptureDialog({
	open,
	onOpenChange,
	line,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Typed before the dialog opened: read straight away. A new object reads again. */
	line?: { text: string } | null;
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
		readLine(text);
	}

	// Each line object reads once, when the dialog opens with it.
	const readFor = useRef<{ text: string } | null>(null);
	useEffect(() => {
		if (!open || !line || readFor.current === line) return;
		readFor.current = line;
		setText(line.text);
		readLine(line.text);
	}, [open, line]);

	function readLine(text: string) {
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
			const walletOf = (id: string | undefined) =>
				result.data.options.wallets.find((w) => w.id === id);
			setPlan(result.data);
			setRows(
				result.data.actions.map((action) => {
					// The wallet the Kuroji form last paid from, when the line named none.
					const last =
						(action.kind === "expense" || action.kind === "income") && !action.walletId
							? walletOf(memory.wallet?.[action.kind])
							: undefined;
					return {
						action:
							last && (action.kind === "expense" || action.kind === "income")
								? withWallet(action, last)
								: action,
						on: true,
					};
				}),
			);
			if (result.data.actions.length === 0 && result.data.skipped.length === 0)
				setError("Nothing to save in that. Try naming an amount, a task or a habit.");
		});
	}

	// A money row handed to Kuroji's own form: what it saves there leaves the list here.
	const [fullForm, setFullForm] = useState<{
		key: string;
		values: AddTransactionFormValues;
	} | null>(null);
	function openFullForm(action: PlannedAction) {
		if (action.kind !== "expense" && action.kind !== "income") return;
		setFullForm({
			key: action.key,
			values: {
				txType: action.kind,
				description: action.description,
				currency: action.currency,
				date: action.date,
				walletId: action.walletId ?? "",
				splits: [{ categoryId: action.categoryId ?? "", amount: action.amount }],
			} as AddTransactionFormValues,
		});
	}
	function savedInFullForm(key: string) {
		const left = rows.filter((r) => r.action.key !== key);
		setRows(left);
		if (left.length === 0) onOpenChange(false);
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
						placeholder="What happened?"
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
								onFullForm={
									row.action.kind === "expense" || row.action.kind === "income"
										? () => openFullForm(row.action)
										: undefined
								}
							/>
						))}
					</ul>
				)}
				{plan && fullForm && (
					<LazyAddTransactionModal
						key={fullForm.key}
						workspaceId={plan.workspaceId}
						baseCurrency={fullForm.values.currency}
						start={fullForm.values}
						open
						onOpenChange={(v) => !v && setFullForm(null)}
						onSaved={() => savedInFullForm(fullForm.key)}
					/>
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
	onFullForm,
}: {
	row: Row;
	options: CapturePlan["options"];
	today: string;
	disabled: boolean;
	onToggle: (on: boolean) => void;
	onChange: (patch: Partial<PlannedAction>) => void;
	/** Opens the app's own form with this row's values (money only). */
	onFullForm?: () => void;
}) {
	const id = useId();
	const { action } = row;
	const ready = isReady(action);
	// Opens by itself when something is missing, and stays open once it's filled in, so the
	// fields don't jump away mid-edit.
	const [editing, setEditing] = useState(!ready);
	useEffect(() => {
		if (!ready) setEditing(true);
	}, [ready]);
	const { app, title, detail } = describeAction(action, options, today);
	const config = APPS_CONFIG[app];
	const open = row.on && editing;

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
			<div className={cn("min-w-0 flex-1", !row.on && "opacity-50")}>
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
							aria-label={open ? `Done editing ${title}` : `Edit ${title}`}
							aria-pressed={open}
							disabled={disabled || (open && !ready)}
							onClick={() => setEditing(!open)}
						>
							<HugeiconsIcon icon={open ? Tick02Icon : PencilEdit02Icon} className="size-4" />
						</Button>
					)}
				</div>
				{open && (
					<div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3">
						<Fields
							action={action}
							options={options}
							today={today}
							disabled={disabled}
							onChange={onChange}
						/>
						{onFullForm && (
							<Button
								type="button"
								variant="link"
								className="col-span-2 h-auto justify-start px-0 text-xs text-muted-foreground"
								disabled={disabled}
								onClick={onFullForm}
							>
								Tags, split or transfer: open the Kuroji form
							</Button>
						)}
					</div>
				)}
			</div>
		</li>
	);
}

/** Everything the app itself would ask for this kind, laid out on a two-column grid. */
function Fields({
	action,
	options,
	today,
	disabled,
	onChange,
}: {
	action: PlannedAction;
	options: CapturePlan["options"];
	today: string;
	disabled: boolean;
	onChange: (patch: Partial<PlannedAction>) => void;
}) {
	const text = (
		label: string,
		value: string,
		key: "title" | "description" | "note",
		placeholder?: string,
	) => (
		<Field label={label} className="col-span-2">
			<Input
				value={value}
				placeholder={placeholder}
				autoComplete="off"
				disabled={disabled}
				className="h-9"
				onChange={(e) => onChange({ [key]: e.target.value })}
			/>
		</Field>
	);
	const date = (label = "Date", max: string | undefined = today) =>
		"date" in action && (
			<Field label={label}>
				<Input
					type="date"
					max={max}
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
				<>
					<Field label="Amount">
						<div className="flex gap-1.5">
							<NumberInput
								value={action.amount}
								disabled={disabled}
								onChange={(amount) => onChange({ amount: amount ?? 0 })}
							/>
							<div className="w-24 shrink-0">
								<CurrencySelect
									value={action.currency}
									onChange={(currency) => onChange({ currency, currencyNamed: true })}
								/>
							</div>
						</div>
					</Field>
					{date()}
					<Field label={action.kind === "income" ? "Received in" : "Paid from"}>
						<Pick
							label="Wallet"
							value={action.walletId}
							items={options.wallets.map((w) => ({ id: w.id, name: `${w.name} · ${w.currency}` }))}
							disabled={disabled}
							onChange={(walletId) => {
								const wallet = options.wallets.find((w) => w.id === walletId);
								if (wallet) onChange(withWallet(action, wallet));
							}}
						/>
					</Field>
					<Field label="Category">
						<Pick
							label="Category"
							value={action.categoryId}
							items={
								action.kind === "income" ? options.incomeCategories : options.expenseCategories
							}
							disabled={disabled}
							onChange={(categoryId) => onChange({ categoryId })}
						/>
					</Field>
					{text("Description", action.description, "description", "Merchant or what it was")}
				</>
			);
		case "want":
			return (
				<>
					{text("Name", action.title, "title")}
					<Field label="Price" className="col-span-2">
						<div className="flex gap-1.5">
							<NumberInput
								value={action.price}
								placeholder="Optional"
								disabled={disabled}
								onChange={(price) => onChange({ price })}
							/>
							<div className="w-24 shrink-0">
								<CurrencySelect
									value={action.currency}
									onChange={(currency) => onChange({ currency })}
								/>
							</div>
						</div>
					</Field>
					{options.lists.length > 0 && (
						<Field label="List" className="col-span-2" as="div">
							<Chips
								value={action.listId}
								items={options.lists}
								disabled={disabled}
								onChange={(listId) => onChange({ listId })}
							/>
						</Field>
					)}
					{text("Why you want it", action.note, "note", "Optional")}
					<div className="col-span-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-field py-1 pr-1 pl-3 text-sm shadow-[inset_0_0_0_1px_var(--input)]">
						<span className="min-w-0 text-muted-foreground">
							{action.now ? (
								<>
									Goes straight to the <span className="text-foreground">Plan</span>
								</>
							) : (
								"Cools for a time set by its price"
							)}
						</span>
						<Toggle checked={action.now} onChange={(now) => onChange({ now })}>
							Need it now
						</Toggle>
					</div>
				</>
			);
		case "card":
			return (
				<>
					{text("Title", action.title, "title")}
					<Field label="Project">
						<Pick
							label="Project"
							value={action.projectId}
							items={options.projects}
							disabled={disabled}
							onChange={(projectId) => onChange({ projectId })}
						/>
					</Field>
					<Field label="Due">
						<Input
							type="date"
							value={action.dueDate ?? ""}
							disabled={disabled}
							className="h-9"
							onChange={(e) => onChange({ dueDate: e.target.value || null })}
						/>
					</Field>
					<Field label="Priority" className="col-span-2" as="div">
						<Chips
							value={action.priority}
							items={PRIORITIES.map((p) => ({ id: p, name: PRIORITY_CONFIG[p].label }))}
							disabled={disabled}
							onChange={(priority) => onChange({ priority: priority as Priority | null })}
						/>
					</Field>
				</>
			);
		case "mileage":
			return (
				<>
					<Field label="Odometer, km">
						<NumberInput
							value={action.km}
							integer
							disabled={disabled}
							onChange={(km) => km != null && onChange({ km })}
						/>
					</Field>
					{date()}
				</>
			);
		case "pages":
			return (
				<Field label={`Page reached, from ${action.from}`}>
					<NumberInput
						value={action.page}
						integer
						disabled={disabled}
						onChange={(page) => page != null && onChange({ page })}
					/>
				</Field>
			);
		case "habit":
			return date("Done on");
	}
}

/** Pick one or none: tap again to clear. */
function Chips({
	value,
	items,
	disabled,
	onChange,
}: {
	value: string | null;
	items: { id: string; name: string }[];
	disabled: boolean;
	onChange: (id: string | null) => void;
}) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{items.map((item) => {
				const on = value === item.id;
				return (
					<button
						key={item.id}
						type="button"
						aria-pressed={on}
						disabled={disabled}
						onClick={() => onChange(on ? null : item.id)}
						className={cn(
							"h-8 rounded-button px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
							on
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-surface-2 hover:text-foreground",
						)}
					>
						{item.name}
					</button>
				);
			})}
		</div>
	);
}

function Field({
	label,
	className,
	as = "label",
	children,
}: {
	label: string;
	className?: string;
	/** "div" for a group of buttons, which a label can't hold. */
	as?: "label" | "div";
	children: React.ReactNode;
}) {
	const Tag = as;
	return (
		<Tag
			className={cn("block min-w-0 space-y-1", className)}
			{...(as === "div" && { role: "group", "aria-label": label })}
		>
			<span className="block text-xs text-muted-foreground">{label}</span>
			{children}
		</Tag>
	);
}

/** Typed as text so "12," stays while typing; reports the number once it reads as one. */
function NumberInput({
	value,
	integer,
	placeholder,
	disabled,
	onChange,
}: {
	value: number | null;
	integer?: boolean;
	placeholder?: string;
	disabled: boolean;
	onChange: (value: number | null) => void;
}) {
	const [text, setText] = useState(value == null ? "" : String(value));
	return (
		<Input
			inputMode={integer ? "numeric" : "decimal"}
			autoComplete="off"
			value={text}
			placeholder={placeholder}
			disabled={disabled}
			className="h-9 min-w-0 font-figures"
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
