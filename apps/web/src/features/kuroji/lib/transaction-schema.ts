import { z } from "zod";
import { CURRENCIES } from "./constants";

const baseFields = {
	description: z.string().optional(),
	amount: z.number({ error: "Amount required" }).positive("Amount must be positive"),
	currency: z.enum(CURRENCIES),
	date: z.string().min(1, "Date required"),
};

// Edit modal schemas — single category per transaction
export const expenseSchema = z.object({
	...baseFields,
	txType: z.literal("expense"),
	walletId: z.string().min(1, "Select a wallet"),
	categoryId: z.string().min(1, "Select a category"),
});

export const incomeSchema = z.object({
	...baseFields,
	txType: z.literal("income"),
	categoryId: z.string().min(1, "Select a category"),
	walletId: z.string().min(1, "Select a wallet"),
});

export const transferSchema = z.object({
	...baseFields,
	txType: z.literal("transfer"),
	fromWalletId: z.string().min(1, "Select from wallet"),
	toWalletId: z.string().min(1, "Select to wallet"),
});

export const transactionFormSchema = z.discriminatedUnion("txType", [
	expenseSchema,
	incomeSchema,
	transferSchema,
]);

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type TxType = "expense" | "income" | "transfer";

// Add modal schemas — split-capable (multiple categories per transaction)
export const splitItemSchema = z.object({
	categoryId: z.string().min(1, "Select a category"),
	amount: z.number({ error: "Amount required" }).positive("Amount must be positive"),
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
