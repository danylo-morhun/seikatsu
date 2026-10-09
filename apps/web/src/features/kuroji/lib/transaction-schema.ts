import { z } from "zod";
import { CURRENCIES } from "./constants";

/**
 * Amount text field → number for the schema. Accepts a decimal comma or dot and grouped
 * forms ("1 234,50", "1.234,50", "1,234.50"). Blank → undefined, unreadable → NaN.
 */
export function parseAmount(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	const text = String(value ?? "").replace(/[\s']/g, "");
	if (text === "") return undefined;
	const at = decimalMarkIndex(text);
	const whole = at === -1 ? text : text.slice(0, at);
	const fraction = at === -1 ? "" : text.slice(at + 1);
	const valid =
		/^-?(\d*|\d{1,3}(,\d{3})+|\d{1,3}(\.\d{3})+)$/.test(whole) &&
		/^\d*$/.test(fraction) &&
		/\d/.test(whole + fraction);
	return valid ? Number(`${whole.replace(/[,.]/g, "")}.${fraction}`) : Number.NaN;
}

/** The decimal mark is the last "," or ".", unless one kind repeats ("1.234.567" is grouping). */
function decimalMarkIndex(text: string) {
	const marks = text.match(/[,.]/g) ?? [];
	if (marks.length > 1 && marks.every((m) => m === marks[0])) return -1;
	return Math.max(text.lastIndexOf(","), text.lastIndexOf("."));
}

/** A positive amount from parseAmount: blank and unreadable text get their own message. */
export const amountSchema = z
	.number({
		error: (iss) => (iss.input === undefined ? "Enter an amount" : "Enter a valid amount"),
	})
	.positive("Amount must be more than zero");

const baseFields = {
	description: z.string().optional(),
	amount: amountSchema,
	currency: z.enum(CURRENCIES),
	date: z.string().min(1, "Date required"),
};

export const transferSchema = z.object({
	...baseFields,
	txType: z.literal("transfer"),
	fromWalletId: z.string().min(1, "Select from wallet"),
	toWalletId: z.string().min(1, "Select to wallet"),
	// Destination amount for cross-currency transfers; blank → converted at the day's rate.
	received: z
		.number({ error: "Enter a valid amount" })
		.positive("Amount must be more than zero")
		.optional(),
});

export type TxType = "expense" | "income" | "transfer";

// Capture and edit form — split-capable (multiple categories per transaction)
export const splitItemSchema = z.object({
	categoryId: z.string().min(1, "Select a category"),
	amount: amountSchema,
});
export type SplitItem = z.infer<typeof splitItemSchema>;

const addBaseFields = {
	description: z.string().optional(),
	currency: z.enum(CURRENCIES),
	date: z.string().min(1, "Date required"),
};

export const addExpenseSchema = z.object({
	...addBaseFields,
	txType: z.literal("expense"),
	walletId: z.string().min(1, "Select a wallet"),
	splits: z.array(splitItemSchema).min(1, "Add at least one category"),
});

export const addIncomeSchema = z.object({
	...addBaseFields,
	txType: z.literal("income"),
	walletId: z.string().min(1, "Select a wallet"),
	splits: z.array(splitItemSchema).min(1, "Add at least one category"),
});

export const addTransactionFormSchema = z.discriminatedUnion("txType", [
	addExpenseSchema,
	addIncomeSchema,
	transferSchema,
]);

export type AddTransactionFormValues = z.infer<typeof addTransactionFormSchema>;

export const DESCRIPTION_PLACEHOLDER: Record<TxType, string> = {
	expense: "e.g. Weekly groceries",
	income: "e.g. October salary",
	transfer: "e.g. Card repayment",
};
