// One line of text → a checked list of actions across the apps. Pure: the prompt and schema the
// model gets, and toPlan(), which keeps only what the user's own data backs up. Nothing here
// writes; the dialog shows the plan and runs each action through its app's own server action.

import { CURRENCIES } from "@/features/kuroji/lib/constants";
import { PRIORITIES, type Priority } from "@/features/seiryu/lib/constants";

export type Named = { id: string; name: string };

/** What the model may point at: only ids from these lists are kept. */
export type CaptureContext = {
	today: string;
	baseCurrency: string;
	wallets: (Named & { currency: string })[];
	expenseCategories: Named[];
	incomeCategories: Named[];
	/** Places they spend at often, as they wrote them, with the category they used. */
	merchants: { name: string; categoryId: string }[];
	vehicle: { id: string; name: string; currentKm: number } | null;
	/** Each with the column new cards land in (the first not-done one). */
	projects: (Named & { columnId: string })[];
	/** Hoshii's lists. */
	lists: Named[];
	/** `today`: on today's list (Keizoku's schedule), and whether it's already done. */
	habits: (Named & { emoji: string; today?: { due: boolean; done: boolean } })[];
	books: { id: string; title: string; currentPage: number; pageCount: number | null }[];
};

export const KINDS = ["expense", "income", "mileage", "want", "card", "habit", "pages"] as const;
export type Kind = (typeof KINDS)[number];

/** The model's answer, one entry per thing to do; every field but `kind` may be null. */
export type RawAction = {
	kind: Kind;
	amount: number | null;
	currency: string | null;
	categoryId: string | null;
	walletId: string | null;
	description: string | null;
	date: string | null;
	km: number | null;
	title: string | null;
	price: number | null;
	listId: string | null;
	now: boolean | null;
	projectId: string | null;
	dueDate: string | null;
	dueTime: string | null;
	priority: Priority | null;
	habitId: string | null;
	bookId: string | null;
	page: number | null;
	pagesRead: number | null;
};

const nullable = (type: string, description: string) => ({ type: [type, "null"], description });

export const RESPONSE_SCHEMA = {
	type: "object",
	properties: {
		actions: {
			type: "array",
			items: {
				type: "object",
				properties: {
					kind: { type: "string", enum: KINDS },
					amount: nullable("number", "expense/income: the amount, positive"),
					currency: nullable("string", "ISO code (PLN, EUR, USD, CHF, GBP, UAH)"),
					categoryId: nullable("string", "expense/income: id from the category list"),
					walletId: nullable("string", "expense/income: id from the wallet list, if named"),
					description: nullable("string", "expense/income: merchant, else a short noun"),
					date: nullable("string", "YYYY-MM-DD when the text names another day"),
					km: nullable("integer", "mileage: the odometer reading in km"),
					title: nullable("string", "want: the thing itself; card: a short imperative"),
					price: nullable("number", "want: price if given"),
					listId: nullable("string", "want: id from the wish list list, if one fits"),
					now: nullable("boolean", "want: true only when it's needed now, not to cool"),
					projectId: nullable("string", "card: id from the project list"),
					dueDate: nullable("string", "card: YYYY-MM-DD when a day to do it by is named"),
					dueTime: nullable("string", "card: HH:MM (24h) when a time of day is named"),
					priority: {
						type: ["string", "null"],
						enum: [...PRIORITIES, null],
						description: "card: only if the text says how urgent",
					},
					habitId: nullable("string", "habit: id from the habit list"),
					bookId: nullable("string", "pages: id from the book list"),
					page: nullable("integer", "pages: the page reached"),
					pagesRead: nullable("integer", "pages: pages read, when no page is given"),
				},
				required: [
					"kind",
					"amount",
					"currency",
					"categoryId",
					"walletId",
					"description",
					"date",
					"km",
					"title",
					"price",
					"listId",
					"now",
					"projectId",
					"dueDate",
					"dueTime",
					"priority",
					"habitId",
					"bookId",
					"page",
					"pagesRead",
				],
			},
		},
	},
	required: ["actions"],
};

const list = <T extends Named>(items: T[], extra?: (item: T) => string) =>
	items.map((i) => `- ${i.id}: ${i.name}${extra ? ` ${extra(i)}` : ""}`).join("\n") || "(none)";

/** The language the apps are kept in: titles come out in it, whatever the line was typed in. */
const LANGUAGE = "English";

export function buildPrompt(text: string, ctx: CaptureContext): string {
	const books = ctx.books.map((b) => ({
		id: b.id,
		name: `${b.title} (on page ${b.currentPage}${b.pageCount ? ` of ${b.pageCount}` : ""})`,
	}));
	return `You turn one line a person typed into actions in their personal apps. The line may be
in Russian, Ukrainian, Polish or English, and may hold several things at once.

Today is ${ctx.today}. Their main currency is ${ctx.baseCurrency}.

Kinds:
- expense: money spent. income: money received. Amount, currency (zł → PLN, грн → UAH,
  € → EUR, $ → USD; none named → null), the best matching category, a short description,
  and the wallet when the line says where it was paid from. Match wallets loosely, as people
  say them: a bank's nickname or a case ending ("с привата", "приватом" → a Privat / P24 wallet;
  "с пекао" → Pekao; "налом", "кэш" → cash), and when a bank has wallets in several
  currencies, the one in the currency named.
- mileage: the car's odometer. Current reading ${ctx.vehicle ? `${ctx.vehicle.currentKm} km` : "unknown (no car)"}.
  "drove 300 km" means km = current + 300.
- want: something to buy ("хочу Kindle", "надо шапку купить"). Title, price if given, the
  list it fits. now = true only when it's needed right away ("срочно", "закончился").
- card: a task to do ("позвонить в СТО"). Title, the project it belongs to if one fits, a due
  date when a day is named ("завтра", "до пятницы"), a due time when an hour is named ("в 15" →
  15:00), priority only when urgency is said.
- habit: a habit done ("был в зале" → the gym habit). Only habits from the list.
- pages: reading progress. page = the page reached ("до 52"); pagesRead when only a count
  is given ("прочитал 20 страниц").

Fuel bought with a reading ("бенз 240 zł, 84 500 км") is two actions: an expense and mileage.
Dates: "вчера" = the day before today; leave date null for today.
Use ids only from these lists; when nothing fits, use null. Never invent ids.
Skip anything that fits no kind.

Write every title and description in ${LANGUAGE}, the way they'd name it in the app themselves,
not a copy of their words:
- want: just the thing, a short noun with a capital letter, brand and model kept
  ("надо шапку купить" → "Hat"; "хочу kindle paperwhite" → "Kindle Paperwhite").
- card: a short imperative ("позвонить в СТО насчёт шин" → "Call the garage about tyres").
- expense/income description: the merchant if named ("Orlen", "Lidl"), else a short noun
  ("Coffee", "Fuel"). Never repeat the amount or the date. A word that isn't an ordinary
  noun is usually a merchant, often typed by ear in Cyrillic: match it to a known merchant
  below ("обрут" → "Obrót Coffee") and take its spelling and its category; an unknown one,
  write it in Latin letters ("обрут" → "Obrot").

Category: a known merchant's category comes first. Otherwise think where the money went:
coffee or a meal out is a cafe or restaurant, not groceries; food bought in a shop is groceries.

Wallets:
${list(ctx.wallets, (w) => `(${w.currency})`)}
Expense categories:
${list(ctx.expenseCategories)}
Known merchants (name → category id):
${ctx.merchants.map((m) => `- ${m.name} → ${m.categoryId}`).join("\n") || "(none)"}
Income categories:
${list(ctx.incomeCategories)}
Projects:
${list(ctx.projects)}
Wish lists:
${list(ctx.lists)}
Habits:
${list(ctx.habits, (h) => h.emoji)}
Books being read:
${list(books)}

The line: ${JSON.stringify(text)}`;
}

/** Past expenses grouped by description and category → each place once, with the category it
 * was filed under most, the most used places first. */
export function pickMerchants(
	rows: { description: string; categoryId: string; uses: number }[],
	limit = 80,
): CaptureContext["merchants"] {
	const best = new Map<string, { name: string; categoryId: string; uses: number }>();
	const total = new Map<string, number>();
	for (const r of rows) {
		const name = r.description.trim();
		const key = name.toLowerCase();
		if (!name) continue;
		total.set(key, (total.get(key) ?? 0) + r.uses);
		const prev = best.get(key);
		if (!prev || r.uses > prev.uses)
			best.set(key, { name, categoryId: r.categoryId, uses: r.uses });
	}
	return [...best.entries()]
		.sort((a, b) => (total.get(b[0]) ?? 0) - (total.get(a[0]) ?? 0))
		.slice(0, limit)
		.map(([, m]) => ({ name: m.name, categoryId: m.categoryId }));
}

/** Paid from this wallet: an amount with no currency named is in the wallet's. */
export function withWallet<A extends Extract<PlannedAction, { kind: "expense" | "income" }>>(
	action: A,
	wallet: { id: string; currency: string },
): A {
	return {
		...action,
		walletId: wallet.id,
		currency: action.currencyNamed ? action.currency : wallet.currency,
	};
}

// ── Checking the answer ──────────────────────────────────────────────────────

type Base = { key: string };

export type PlannedAction = Base &
	(
		| {
				kind: "expense" | "income";
				amount: number;
				currency: string;
				/** The line named the currency; else it follows the wallet. */
				currencyNamed: boolean;
				/** Null: the dialog asks for it before saving. */
				categoryId: string | null;
				walletId: string | null;
				description: string;
				date: string;
		  }
		| {
				kind: "mileage";
				vehicleId: string;
				vehicleName: string;
				km: number;
				/** The odometer before, so the dialog can show how far that is. */
				from: number;
				date: string;
		  }
		| {
				kind: "want";
				title: string;
				price: number | null;
				currency: string;
				listId: string | null;
				note: string;
				/** Straight to the Plan, no cooling. */
				now: boolean;
		  }
		| {
				kind: "card";
				title: string;
				projectId: string | null;
				dueDate: string | null;
				/** "HH:MM"; only with a day. */
				dueTime: string | null;
				priority: Priority | null;
		  }
		| { kind: "habit"; habitId: string; name: string; emoji: string; date: string }
		| { kind: "pages"; bookId: string; title: string; page: number; from: number; date: string }
	);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A day the text named, never in the future; else today. */
function dayOf(date: string | null, today: string): string {
	return date && DAY.test(date) && !Number.isNaN(Date.parse(date)) && date <= today ? date : today;
}

/** A due day: any valid date, past or future. */
function dueOf(date: string | null): string | null {
	return date && DAY.test(date) && !Number.isNaN(Date.parse(date)) ? date : null;
}

/** A time of day, "HH:MM", or null. */
function timeOf(time: string | null): string | null {
	const m = time?.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
	return m ? `${(m[1] ?? "").padStart(2, "0")}:${m[2]}` : null;
}

function currencyOf(code: string | null, fallback: string): string {
	const upper = code?.toUpperCase();
	return upper && (CURRENCIES as readonly string[]).includes(upper) ? upper : fallback;
}

const clean = (s: string | null) => s?.trim() || null;
const known = <T extends { id: string }>(items: T[], id: string | null) =>
	id ? (items.find((i) => i.id === id) ?? null) : null;

const KM = new Intl.NumberFormat("pl-PL");

/** One raw action → a planned one; a sentence when it can't be done (the dialog says why);
 * null for an entry too empty to mention. */
function plan(raw: RawAction, ctx: CaptureContext, key: string): PlannedAction | string | null {
	switch (raw.kind) {
		case "expense":
		case "income": {
			if (raw.amount == null || !(raw.amount > 0) || raw.amount > 1e9) return null;
			const categories = raw.kind === "expense" ? ctx.expenseCategories : ctx.incomeCategories;
			const wallet = known(ctx.wallets, raw.walletId);
			return {
				key,
				kind: raw.kind,
				amount: Math.round(raw.amount * 100) / 100,
				currency: currencyOf(raw.currency, wallet?.currency ?? ctx.baseCurrency),
				currencyNamed: currencyOf(raw.currency, "") !== "",
				categoryId: known(categories, raw.categoryId)?.id ?? null,
				walletId: wallet?.id ?? null,
				description: clean(raw.description) ?? "",
				date: dayOf(raw.date, ctx.today),
			};
		}
		case "mileage": {
			const car = ctx.vehicle;
			if (raw.km == null || !Number.isInteger(raw.km)) return null;
			if (!car) return `Mileage ${KM.format(raw.km)} km: there's no car in Aisha yet.`;
			// Aisha's rule: the odometer only goes up. Today's reading can't be below the last one;
			// an earlier day is checked by Aisha against the readings around it.
			const date = dayOf(raw.date, ctx.today);
			if (date === ctx.today && raw.km <= car.currentKm)
				return `Mileage ${KM.format(raw.km)} km: the odometer already reads ${KM.format(car.currentKm)} km.`;
			return {
				key,
				kind: "mileage",
				vehicleId: car.id,
				vehicleName: car.name,
				km: raw.km,
				from: car.currentKm,
				date,
			};
		}
		case "want": {
			const title = clean(raw.title);
			if (!title) return null;
			const price = raw.price != null && raw.price > 0 ? Math.round(raw.price * 100) / 100 : null;
			return {
				key,
				kind: "want",
				title: title.slice(0, 200),
				price,
				currency: currencyOf(raw.currency, ctx.baseCurrency),
				listId: known(ctx.lists, raw.listId)?.id ?? null,
				note: "",
				now: raw.now === true,
			};
		}
		case "card": {
			const title = clean(raw.title);
			if (!title) return null;
			const project =
				known(ctx.projects, raw.projectId) ?? (ctx.projects.length === 1 ? ctx.projects[0] : null);
			const dueDate = dueOf(raw.dueDate);
			return {
				key,
				kind: "card",
				title: title.slice(0, 500),
				projectId: project?.id ?? null,
				dueDate,
				dueTime: dueDate ? timeOf(raw.dueTime) : null,
				priority: raw.priority && PRIORITIES.includes(raw.priority) ? raw.priority : null,
			};
		}
		case "habit": {
			const habit = known(ctx.habits, raw.habitId);
			if (!habit) return "A habit that isn't in Keizoku: add it there first.";
			const date = dayOf(raw.date, ctx.today);
			if (date === ctx.today && habit.today?.done)
				return `${habit.emoji} ${habit.name}: already done today.`.trim();
			if (date === ctx.today && habit.today && !habit.today.due)
				return `${habit.emoji} ${habit.name}: not on today's list in Keizoku.`.trim();
			return {
				key,
				kind: "habit",
				habitId: habit.id,
				name: habit.name,
				emoji: habit.emoji,
				date,
			};
		}
		case "pages": {
			// One book on the go: it's that one, whatever the model picked.
			const book = known(ctx.books, raw.bookId) ?? (ctx.books.length === 1 ? ctx.books[0] : null);
			if (!book)
				return ctx.books.length === 0
					? "Pages read: no book is marked as reading in Tsundoku."
					: "Pages read: say which book.";
			const page =
				raw.page != null
					? raw.page
					: raw.pagesRead != null
						? book.currentPage + raw.pagesRead
						: null;
			if (page == null || !Number.isInteger(page)) return null;
			if (page <= book.currentPage)
				return `${book.title}: you're already on page ${book.currentPage}.`;
			const capped = book.pageCount ? Math.min(page, book.pageCount) : page;
			return {
				key,
				kind: "pages",
				bookId: book.id,
				title: book.title,
				page: capped,
				from: book.currentPage,
				// "Read 20 pages yesterday" goes on yesterday, as in Tsundoku's own log.
				date: dayOf(raw.date, ctx.today),
			};
		}
		default:
			return null;
	}
}

/** The model's answer, checked against the user's data: what can be saved, and why the rest
 * can't. Unknown kinds and empty entries drop out unmentioned. */
export function toPlan(
	answer: unknown,
	ctx: CaptureContext,
): { actions: PlannedAction[]; skipped: string[] } {
	const raw = (answer as { actions?: unknown } | null)?.actions;
	const planned = (Array.isArray(raw) ? raw : [])
		.filter(
			(a): a is RawAction =>
				typeof a === "object" && a !== null && KINDS.includes((a as RawAction).kind),
		)
		.slice(0, 10)
		.map((a, i) => plan(withNulls(a), ctx, `a${i}`));
	return {
		actions: planned.filter((p): p is PlannedAction => typeof p === "object" && p !== null),
		skipped: planned.filter((p): p is string => typeof p === "string"),
	};
}

/** Missing fields read as null, and fields of the wrong type too. */
function withNulls(raw: RawAction): RawAction {
	const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
	const str = (v: unknown) => (typeof v === "string" ? v : null);
	return {
		kind: raw.kind,
		amount: num(raw.amount),
		currency: str(raw.currency),
		categoryId: str(raw.categoryId),
		walletId: str(raw.walletId),
		description: str(raw.description),
		date: str(raw.date),
		km: num(raw.km),
		title: str(raw.title),
		price: num(raw.price),
		listId: str(raw.listId),
		now: typeof raw.now === "boolean" ? raw.now : null,
		projectId: str(raw.projectId),
		dueDate: str(raw.dueDate),
		dueTime: str(raw.dueTime),
		priority: str(raw.priority) as Priority | null,
		habitId: str(raw.habitId),
		bookId: str(raw.bookId),
		page: num(raw.page),
		pagesRead: num(raw.pagesRead),
	};
}

/** Whether an action has all it needs (after the user's edits); Save waits until it does. */
export function isReady(action: PlannedAction): boolean {
	switch (action.kind) {
		case "expense":
		case "income":
			return action.amount > 0 && action.categoryId != null && action.walletId != null;
		case "card":
			return action.projectId != null && action.title.trim() !== "";
		case "want":
			return action.title.trim() !== "" && (action.price == null || action.price > 0);
		case "mileage":
			return action.km > action.from;
		case "pages":
			return action.page > action.from;
		case "habit":
			return true;
	}
}
