import { z } from "zod";
import { readBalances } from "@/features/kuroji/actions/balances";
import {
	getRecentTransactions,
	getRecurringTransactions,
	getTags,
} from "@/features/kuroji/actions/data";
import { getPlan } from "@/features/kuroji/actions/plan-data";
import { createTransaction } from "@/features/kuroji/actions/transactions";
import { getMonthlyTrends } from "@/features/kuroji/actions/trends";
import { day } from "./shell";
import { tool } from "./types";

const month = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM");
const n = (s: string) => Math.round(Number(s) * 100) / 100;

export const kurojiTools = [
	tool({
		name: "kuroji_accounts",
		title: "Kuroji accounts & balances",
		description:
			"Every Kuroji account with its id: ASSET/LIABILITY balances as of `to` (default today), and INCOME/EXPENSE totals for `from`–`to` (default this month). `balance` is in the base currency, `native` in the account's own. Hidden accounts are flagged and left out of `netWorth`, as in the app. Use the ids for kuroji_transactions and kuroji_add_transaction.",
		input: { from: day.optional(), to: day.optional() },
		run: async ({ from, to }, { ws, today }) => {
			const end = to ?? today;
			const start = from ?? `${end.slice(0, 7)}-01`;
			const rows = await readBalances(ws, start, end, today);
			const pick = (type: string) =>
				rows
					.filter((r) => r.type === type)
					.map((r) => ({
						id: r.accountId,
						name: r.name,
						parentId: r.parentId,
						currency: r.currency,
						balance: n(r.balance),
						native: r.currency === ws.baseCurrency ? undefined : n(r.nativeBalance),
						hidden: r.hidden || undefined,
					}));
			const assets = pick("ASSET");
			const liabilities = pick("LIABILITY");
			const visible = (list: typeof assets) =>
				list.filter((a) => !a.hidden).reduce((s, a) => s + a.balance, 0);
			return {
				baseCurrency: ws.baseCurrency,
				balancesAsOf: end,
				flowsFrom: start,
				netWorth: n(String(visible(assets) + visible(liabilities))),
				assets,
				liabilities,
				expenses: pick("EXPENSE"),
				income: pick("INCOME"),
			};
		},
	}),
	tool({
		name: "kuroji_transactions",
		title: "Kuroji transactions",
		description:
			"Search transactions, newest first, 50 per page. Filters: date range, accountIds (from kuroji_accounts), tagId (kuroji_tags), q = text in the description. Each row: from → to account, amount in its currency, baseAmount in the base currency, tags.",
		input: {
			from: day.optional(),
			to: day.optional(),
			accountIds: z.array(z.uuid()).max(50).optional(),
			tagId: z.uuid().optional(),
			q: z.string().max(200).optional(),
			sort: z.enum(["date", "amount"]).optional(),
			page: z.number().int().min(0).default(0),
		},
		run: async ({ sort, page, ...filters }, { ws }) => {
			const res = await getRecentTransactions(
				ws.id,
				{ ...filters, sortField: sort, sortDir: "desc" },
				page,
			);
			return {
				total: res.total,
				page: res.page,
				hasMore: res.hasMore,
				rows: res.rows.map((r) => ({
					id: r.id,
					date: r.date,
					description: r.description,
					from: r.fromAccount,
					fromId: r.fromAccountId,
					to: r.toAccount,
					toId: r.toAccountId,
					amount: Number(r.amount),
					currency: r.currency,
					...(r.fromCurrency !== r.currency
						? { fromAmount: Number(r.fromAmount), fromCurrency: r.fromCurrency }
						: {}),
					baseAmount: n(r.baseAmount),
					tags: r.tags.map((t) => t.name),
					imported: r.imported || undefined,
				})),
			};
		},
	}),
	tool({
		name: "kuroji_plan",
		title: "Kuroji month plan",
		description:
			"The Plan tab for one month (default this one): planned vs actual per category, pace through the month, upcoming recurring payments, funds (savings goals) and totals (income plan, expense plan, free). Base currency.",
		input: { month: month.optional() },
		run: async ({ month: m }, { ws, today }) => {
			const {
				assetAccounts: _a,
				categories: _c,
				...plan
			} = await getPlan(ws.id, m ?? today.slice(0, 7));
			return plan;
		},
	}),
	tool({
		name: "kuroji_trends",
		title: "Kuroji monthly flow",
		description: "Income and expenses per month for the last `months` months (base currency).",
		input: { months: z.number().int().min(1).max(36).default(6) },
		run: ({ months }, { ws }) => getMonthlyTrends(ws.id, undefined, undefined, months),
	}),
	tool({
		name: "kuroji_tags",
		title: "Kuroji tags",
		description: "Transaction tags with their ids.",
		input: {},
		run: async (_a, { ws }) => (await getTags(ws.id)).map((t) => ({ id: t.id, name: t.name })),
	}),
	tool({
		name: "kuroji_recurring",
		title: "Kuroji recurring",
		description:
			"Recurring transactions: amount, frequency, next date, accounts, active or paused.",
		input: {},
		run: (_a, { ws }) => getRecurringTransactions(ws.id),
	}),
	tool({
		name: "kuroji_add_transaction",
		title: "Add a Kuroji transaction",
		description:
			"Record money moving between two accounts (ids from kuroji_accounts). Expense: from an ASSET (wallet/card) to an EXPENSE category. Income: from an INCOME account to an ASSET. Transfer: ASSET → ASSET (cross-currency: pass `received` in the destination's currency). `amount` is in `currency` (usually the paying account's). Pass a fresh `requestId` (uuid) so a retry never books it twice.",
		input: {
			fromAccountId: z.uuid(),
			toAccountId: z.uuid(),
			amount: z.number().positive().max(1e12),
			currency: z.string().regex(/^[A-Z]{3}$/),
			date: day.optional(),
			description: z.string().max(500).optional(),
			tagIds: z.array(z.uuid()).max(20).optional(),
			received: z.number().positive().max(1e12).optional(),
			requestId: z.uuid().optional(),
		},
		write: true,
		idempotent: true,
		run: ({ requestId, date, ...input }, { ws, today }) =>
			createTransaction({ workspaceId: ws.id, id: requestId, date: date ?? today, ...input }),
	}),
];
