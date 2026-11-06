import { z } from "zod";
import { getHoshii, type HoshiiItem } from "@/features/hoshii/actions/data";
import { buyItem, createItem, moveItem } from "@/features/hoshii/actions/items";
import { readLink } from "@/features/hoshii/actions/link";
import { page } from "@/features/mcp/lib/compact";
import { day } from "./shell";
import { tool } from "./types";

const id = z.uuid();

const want = (i: HoshiiItem) => ({
	id: i.id,
	title: i.title,
	state: i.state,
	price: i.price == null ? null : Number(i.price),
	currency: i.currency,
	priceBase: i.base,
	list: i.listName,
	note: i.note,
	addedOn: i.addedOn,
	coolUntil: i.state === "cooling" ? i.coolUntil : undefined,
	keptOn: i.keptOn,
	boughtOn: i.boughtOn,
	releasedOn: i.releasedOn,
	links: i.links.map((l) => l.url),
});

export const hoshiiTools = [
	tool({
		name: "hoshii_overview",
		title: "Hoshii wishlist",
		description:
			"The wishlist flow: `decide` (done cooling — keep or let go?), `cooling` (still waiting, with coolUntil), `plan` (kept, ranked, each with how much the piggy account funds: share 1 = can buy), lists, piggy balance and this month's wants budget. Base currency.",
		input: {},
		run: async (_a, { ws, today }) => {
			const h = await getHoshii(ws, today);
			return {
				currency: h.currency,
				piggy: h.piggy,
				budget: h.budget,
				lists: h.lists.map(({ position, ...l }) => l),
				decide: h.queue.decide.map(want),
				cooling: h.queue.cooling.map(want),
				plan: h.queue.plan.map((p) => ({
					...want(p.item),
					cost: p.cost,
					funded: p.funded,
					share: p.share,
				})),
			};
		},
	}),
	tool({
		name: "hoshii_history",
		title: "Hoshii bought & let go",
		description: "Wants already bought (with what was paid) or let go, newest first, 50 per page.",
		input: { state: z.enum(["bought", "released"]), offset: z.number().int().min(0).default(0) },
		run: async ({ state, offset }, { ws, today }) => {
			const h = await getHoshii(ws, today);
			const rows = h.items
				.filter((i) => i.state === state)
				.sort((a, b) =>
					(a.boughtOn ?? a.releasedOn ?? "") < (b.boughtOn ?? b.releasedOn ?? "") ? 1 : -1,
				)
				.map((i) => ({
					...want(i),
					paid: i.boughtPrice == null ? undefined : Number(i.boughtPrice),
					paidCurrency: i.boughtCurrency,
				}));
			return page(rows, offset, 50);
		},
	}),
	tool({
		name: "hoshii_add_want",
		title: "Add a want",
		description:
			"Add something the user wants. Give a title, or a shop `url` (title, photo and price are read from the page when not given). It starts cooling for the user's price tier, unless `skipCooling` (needs it now → straight to the Plan). Pass a fresh requestId (uuid).",
		input: {
			title: z.string().max(200).optional(),
			url: z.url().optional(),
			price: z.number().positive().max(1e9).optional(),
			currency: z
				.string()
				.regex(/^[A-Z]{3}$/)
				.optional(),
			listId: id.optional(),
			note: z.string().max(1000).optional(),
			skipCooling: z.boolean().optional(),
			requestId: id.optional(),
		},
		write: true,
		idempotent: true,
		run: async (
			{ title, url, price, currency, listId, note, skipCooling, requestId },
			{ ws, today },
		) => {
			const read = url ? await readLink(url) : null;
			const info = read && "success" in read ? read.data : null;
			const name = title?.trim() || info?.title;
			if (!name)
				return { error: url ? "Couldn't read a name from the link; give a title" : "Give a title" };
			const cur = currency ?? (price === undefined ? info?.currency : null) ?? ws.baseCurrency;
			return createItem({
				id: requestId,
				title: name.slice(0, 200),
				links: url
					? [
							{
								url,
								title: info?.title ?? null,
								imageUrl: info?.imageUrl ?? null,
								price: info?.price ?? null,
								currency: info?.currency ?? null,
							},
						]
					: [],
				imageUrl: info?.imageUrl ?? null,
				price: price ?? info?.price ?? null,
				currency: cur,
				listId: listId ?? null,
				note: note ?? null,
				skipCooling,
				on: today,
			});
		},
	}),
	tool({
		name: "hoshii_decide",
		title: "Keep or let go",
		description:
			"Decide on a want: `keep` (to the Plan), `let_go` (its price counts as saved), or `cooling` (back to waiting).",
		input: { itemId: id, decision: z.enum(["keep", "let_go", "cooling"]) },
		write: true,
		idempotent: true,
		run: ({ itemId, decision }, { today }) =>
			moveItem(
				itemId,
				decision === "keep" ? "plan" : decision === "let_go" ? "released" : "cooling",
				today,
			),
	}),
	tool({
		name: "hoshii_bought",
		title: "Mark a want bought",
		description:
			"Mark a want bought for `paid` in `currency` on `date` (default today). Optionally book it in Kuroji (walletId = ASSET paid from, categoryId = EXPENSE). Pass a fresh requestId (uuid) so the expense posts once.",
		input: {
			itemId: id,
			paid: z.number().positive().max(1e9),
			currency: z.string().regex(/^[A-Z]{3}$/),
			date: day.optional(),
			kuroji: z.object({ walletId: id, categoryId: id }).nullable().default(null),
			requestId: id.optional(),
		},
		write: true,
		idempotent: true,
		run: ({ itemId, requestId, date, ...values }, { today }) =>
			buyItem(itemId, { ...values, date: date ?? today, expenseId: requestId }),
	}),
];
