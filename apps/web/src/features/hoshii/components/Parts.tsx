"use client";

import { CURRENCIES } from "@/features/kuroji/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@seikatsu/ui";

/** An on/off switch with its label, for a choice inside a form. */
export function Toggle({
	checked,
	onChange,
	children,
	className,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className={cn(
				"inline-flex min-h-9 items-center gap-2 rounded-md text-sm whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
				checked && "text-foreground",
				className,
			)}
		>
			<span
				aria-hidden
				className={cn(
					"relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-150",
					checked ? "bg-primary" : "bg-surface-2 shadow-[inset_0_0_0_1px_var(--input)]",
				)}
			>
				<span
					className={cn(
						"absolute top-[3px] left-[3px] size-3 rounded-full transition-[transform,background-color] duration-200 ease-out",
						checked ? "translate-x-3.5 bg-primary-foreground" : "bg-muted-foreground",
					)}
				/>
			</span>
			{children}
		</button>
	);
}

/** Kuroji's currencies, plus the want's own if a shop priced it in another. */
export function CurrencySelect({
	id,
	value,
	onChange,
	label = "Currency",
}: {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	label?: string;
}) {
	const options = (CURRENCIES as readonly string[]).includes(value)
		? CURRENCIES
		: [value, ...CURRENCIES];
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger id={id} aria-label={id ? undefined : label} className="w-full">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((c) => (
					<SelectItem key={c} value={c}>
						{c}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
