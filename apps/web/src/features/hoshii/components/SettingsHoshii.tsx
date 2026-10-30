"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { SettingsSection } from "@/components/SettingsSection";
import { parseNumber } from "@/features/aisha/lib/format";
import type { HoshiiList } from "@/features/hoshii/actions/data";
import { createList, deleteList, renameList } from "@/features/hoshii/actions/lists";
import { saveSettings } from "@/features/hoshii/actions/settings";
import type { SettingsValues } from "@/features/hoshii/lib/hoshii-schemas";
import type { FormAccount } from "@/features/kuroji/actions/form-options";
import { AccountPicker } from "@/features/kuroji/components/AccountSelect";
import { Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input } from "@seikatsu/ui";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

const FAILED = { error: "Couldn't save. Check your connection." };
type Settings = Omit<SettingsValues, "piggyAccountId" | "walletId" | "categoryId"> & {
	piggyAccountId: string | null;
	walletId: string | null;
	categoryId: string | null;
};

/** /settings/hoshii: the piggy, where purchases go in Kuroji, cooling times, and the lists. */
export function SettingsHoshii({
	settings,
	lists,
	accounts,
	currency,
}: {
	settings: Settings;
	lists: HoshiiList[];
	accounts: FormAccount[];
	currency: string;
}) {
	const [, startTransition] = useTransition();
	const [saved, setOptimistic] = useOptimistic(settings, (s, patch: Partial<Settings>) => ({
		...s,
		...patch,
	}));

	function save(patch: Partial<Settings>) {
		const next = { ...saved, ...patch };
		startTransition(async () => {
			setOptimistic(patch);
			const result = await saveSettings(next).catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<>
			<SettingsSection
				title="Piggy"
				description="A Kuroji account you save into for wants. Its balance pays for the Plan from the top: the first want is covered in full before the next gets anything."
			>
				<div className="flex max-w-lg flex-wrap items-center gap-3">
					<div className="min-w-56 flex-1">
						<AccountPicker
							aria-label="Piggy"
							placeholder="Pick a savings account"
							accounts={accounts.filter((a) => a.type === "ASSET")}
							value={saved.piggyAccountId ?? ""}
							onValueChange={(piggyAccountId) =>
								save({
									piggyAccountId,
									// Purchases come out of the piggy unless set otherwise.
									walletId: saved.walletId ?? piggyAccountId,
								})
							}
						/>
					</div>
					{saved.piggyAccountId && (
						<Button variant="ghost" size="sm" onClick={() => save({ piggyAccountId: null })}>
							No piggy
						</Button>
					)}
				</div>
			</SettingsSection>

			<SettingsSection
				title="Purchases in Kuroji"
				description="“Bought it” records an expense: paid from this account, into this category, unless you pick others then. Give the category a monthly budget in Kuroji and Now shows what's left of it."
			>
				<div className="grid max-w-lg gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<p className="text-sm font-medium leading-none">Paid from</p>
						<AccountPicker
							aria-label="Paid from"
							placeholder="Pick an account"
							accounts={accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY")}
							value={saved.walletId ?? ""}
							onValueChange={(walletId) => save({ walletId })}
						/>
					</div>
					<div className="space-y-2">
						<p className="text-sm font-medium leading-none">Category</p>
						<AccountPicker
							aria-label="Expense category"
							placeholder="Pick a category"
							accounts={accounts.filter((a) => a.type === "EXPENSE")}
							value={saved.categoryId ?? ""}
							onValueChange={(categoryId) => save({ categoryId })}
						/>
					</div>
				</div>
			</SettingsSection>

			<SettingsSection
				title="Cooling"
				description="How long a new want waits before Hoshii asks if you still want it, by its price. A changed price while cooling re-times it."
			>
				<div className="max-w-lg inset-group text-sm">
					<TierRow
						label={
							<>
								Under{" "}
								<NumberField
									label="Small wants are under"
									value={saved.smallBelow}
									onSave={(smallBelow) => save({ smallBelow })}
								/>{" "}
								{currency}
							</>
						}
						days={saved.smallDays}
						onDays={(smallDays) => save({ smallDays })}
						what="small wants"
					/>
					<TierRow
						label={
							<>
								Under{" "}
								<NumberField
									label="Big wants start at"
									value={saved.largeFrom}
									onSave={(largeFrom) => save({ largeFrom })}
								/>{" "}
								{currency}, or no price
							</>
						}
						days={saved.midDays}
						onDays={(midDays) => save({ midDays })}
						what="middle wants"
					/>
					<TierRow
						label={`${saved.largeFrom.toLocaleString("pl-PL")} ${currency} and more`}
						days={saved.largeDays}
						onDays={(largeDays) => save({ largeDays })}
						what="big wants"
					/>
				</div>
			</SettingsSection>

			<Lists lists={lists} />
		</>
	);
}

function TierRow({
	label,
	days,
	onDays,
	what,
}: {
	label: React.ReactNode;
	days: number;
	onDays: (days: number) => void;
	what: string;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
			<span className="text-muted-foreground">{label}</span>
			<span className="flex items-center gap-2">
				<NumberField label={`Days for ${what}`} value={days} onSave={onDays} />
				days
			</span>
		</div>
	);
}

/** A small whole-number field that saves when it loses focus. */
function NumberField({
	label,
	value,
	onSave,
}: {
	label: string;
	value: number;
	onSave: (value: number) => void;
}) {
	const [text, setText] = useState(String(value));
	const [last, setLast] = useState(value);
	if (value !== last) {
		setLast(value);
		setText(String(value));
	}
	function commit() {
		const n = parseNumber(text);
		if (n == null || n < 0 || !Number.isInteger(n)) {
			setText(String(value));
			return;
		}
		if (n !== value) onSave(n);
	}
	return (
		<Input
			aria-label={label}
			inputMode="numeric"
			autoComplete="off"
			className="inline-flex h-8 w-20 px-2 text-right font-figures"
			value={text}
			onChange={(e) => setText(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
		/>
	);
}

function Lists({ lists }: { lists: HoshiiList[] }) {
	const [name, setName] = useState("");
	const [deleting, setDeleting] = useState<HoshiiList | null>(null);
	const [isAdding, startAdd] = useTransition();

	function add(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		startAdd(async () => {
			const result = await createList(name).catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
			else setName("");
		});
	}

	return (
		<SettingsSection
			title="Lists"
			description="Where wants live: Tech, Home, Clothes. A filter on Lists; the Plan ranks across all of them."
			meta={lists.length}
		>
			{lists.length > 0 && (
				<ul className="max-w-lg inset-group">
					{lists.map((list) => (
						<ListRow key={list.id} list={list} onDelete={() => setDeleting(list)} />
					))}
				</ul>
			)}
			<form onSubmit={add} className="mt-3 flex max-w-lg gap-2">
				<Input
					aria-label="New list"
					placeholder="New list"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
				<Button type="submit" variant="outline" disabled={isAdding || !name.trim()}>
					Add
				</Button>
			</form>
			<ConfirmDelete
				open={deleting != null}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete “${deleting?.name ?? ""}”?`}
				description="The list goes; its wants stay, in no list."
				onConfirm={async () => {
					if (!deleting) return;
					const result = await deleteList(deleting.id).catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
				}}
			/>
		</SettingsSection>
	);
}

function ListRow({ list, onDelete }: { list: HoshiiList; onDelete: () => void }) {
	const [name, setName] = useState(list.name);
	function commit() {
		const next = name.trim();
		if (!next || next === list.name) {
			setName(list.name);
			return;
		}
		renameList(list.id, next)
			.catch(() => FAILED)
			.then((result) => {
				if ("error" in result) {
					toast.error(result.error);
					setName(list.name);
				}
			});
	}
	return (
		<li className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 py-1">
			<Input
				aria-label={`Rename ${list.name}`}
				className="h-9 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input"
				value={name}
				onChange={(e) => setName(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
			/>
			<span className="font-figures text-xs text-muted-foreground">
				{list.count} {list.count === 1 ? "want" : "wants"}
			</span>
			<Button
				variant="ghost"
				size="icon"
				aria-label={`Delete ${list.name}`}
				className="text-muted-foreground hover:text-destructive"
				onClick={onDelete}
			>
				<HugeiconsIcon icon={Delete01Icon} className="size-4" />
			</Button>
		</li>
	);
}
