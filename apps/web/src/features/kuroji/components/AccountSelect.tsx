"use client";

import type { getAccounts } from "@/features/kuroji/actions/accounts";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];

// System account the starter ledger uses for opening balances; never a place to post to.
const SYSTEM_NAMES = new Set(["Opening Balance"]);

interface Props {
	control: Control<never>;
	name: string;
	accounts: Account[];
	placeholder: string;
	error?: string;
	/** Associates the visible label with the trigger. */
	id?: string;
	/** Names the trigger when no visible label points at it. */
	"aria-label"?: string;
}

/** AccountPicker bound to a react-hook-form field, with its error below. */
export function AccountSelect({
	control,
	name,
	accounts,
	placeholder,
	error,
	id,
	"aria-label": ariaLabel,
}: Props) {
	return (
		<Controller
			control={control as never}
			name={name as never}
			render={({ field }: { field: { onChange: (v: string) => void; value: string } }) => (
				<>
					<AccountPicker
						id={id}
						aria-label={ariaLabel}
						value={field.value ?? ""}
						onValueChange={field.onChange}
						accounts={accounts}
						placeholder={placeholder}
						invalid={!!error}
					/>
					{error && <p className="text-destructive text-[0.8rem]">{error}</p>}
				</>
			)}
		/>
	);
}

/**
 * Accounts as the tree they are: a parent with sub-accounts becomes a heading and only its
 * sub-accounts can be picked, so "Bank Pekao" and "Pekao PLN" never compete. A value that
 * already points at a parent (older transactions) stays selectable so editing keeps it.
 */
export function AccountPicker({
	value,
	onValueChange,
	accounts,
	placeholder,
	invalid,
	id,
	className,
	"aria-label": ariaLabel,
}: {
	value: string;
	onValueChange: (id: string) => void;
	accounts: Account[];
	placeholder: string;
	invalid?: boolean;
	id?: string;
	className?: string;
	"aria-label"?: string;
}) {
	const visible = accounts.filter((a) => !SYSTEM_NAMES.has(a.name) || a.id === value);
	const ids = new Set(visible.map((a) => a.id));
	const childrenOf = new Map<string, Account[]>();
	for (const a of visible) {
		if (a.parentId && ids.has(a.parentId)) {
			childrenOf.set(a.parentId, [...(childrenOf.get(a.parentId) ?? []), a]);
		}
	}
	const roots = visible
		.filter((a) => !a.parentId || !ids.has(a.parentId))
		.sort((a, b) => a.name.localeCompare(b.name));
	const leaves = roots.filter((a) => !childrenOf.has(a.id));
	const parents = roots.filter((a) => childrenOf.has(a.id));
	// Every postable account under a parent, however deep, labelled by its path.
	const leafDescendants = (parentId: string, prefix = ""): { a: Account; label: string }[] =>
		(childrenOf.get(parentId) ?? [])
			.sort((x, y) => x.name.localeCompare(y.name))
			.flatMap((c) =>
				childrenOf.has(c.id)
					? leafDescendants(c.id, `${prefix}${c.name} / `)
					: [{ a: c, label: `${prefix}${c.name}` }],
			);
	// A mid-level parent picked by an older transaction stays visible.
	const current = visible.find((a) => a.id === value);
	const currentMidParent =
		current?.parentId && ids.has(current.parentId) && childrenOf.has(current.id) ? current : null;

	return (
		<Select onValueChange={onValueChange} value={value}>
			<SelectTrigger
				id={id}
				className={className}
				aria-label={ariaLabel}
				aria-invalid={invalid || undefined}
			>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{currentMidParent && (
					<SelectItem value={currentMidParent.id}>{currentMidParent.name}</SelectItem>
				)}
				{leaves.map((a) => (
					<SelectItem key={a.id} value={a.id}>
						{a.name}
					</SelectItem>
				))}
				{parents.map((p) => (
					<SelectGroup key={p.id}>
						<SelectLabel>{p.name}</SelectLabel>
						{p.id === value && <SelectItem value={p.id}>{p.name}</SelectItem>}
						{leafDescendants(p.id).map(({ a, label }) => (
							<SelectItem key={a.id} value={a.id} className="pl-5">
								{label}
							</SelectItem>
						))}
					</SelectGroup>
				))}
			</SelectContent>
		</Select>
	);
}
