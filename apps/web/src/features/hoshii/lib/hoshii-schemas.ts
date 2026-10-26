import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().finite().nonnegative().max(1e12);
const currency = z.string().regex(/^[A-Z]{3}$/, "Pick a currency");
const webUrl = z
	.string()
	.trim()
	.max(2000)
	.refine((v) => /^https?:\/\//i.test(v) && URL.canParse(v), "Enter a web link");
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullable()
		.transform((v) => v || null);

/** A want, new or edited. The id is made on the device so a resend lands once. */
export const itemFormSchema = z.object({
	id: z.uuid().optional(),
	title: z.string().trim().min(1, "Name the want").max(200),
	url: webUrl.nullable(),
	imageUrl: webUrl.nullable(),
	price: money.nullable(),
	currency,
	listId: z.uuid().nullable(),
	note: optionalText(1000),
	/** New wants only: straight to the Plan. */
	skipCooling: z.boolean().optional(),
});
export type ItemFormValues = z.input<typeof itemFormSchema>;

export const moveTargets = ["plan", "released", "cooling"] as const;
export type MoveTarget = (typeof moveTargets)[number];
export const moveSchema = z.object({
	itemId: z.uuid(),
	to: z.enum(moveTargets),
	/** The user's day when it was decided, so a late sync dates it right. */
	on: day,
});

export const buySchema = z.object({
	paid: money,
	currency,
	date: day,
	kuroji: z.object({ walletId: z.uuid(), categoryId: z.uuid() }).nullable(),
});
export type BuyValues = z.input<typeof buySchema>;

export const listNameSchema = z.string().trim().min(1, "Name the list").max(40);

const days = z.number().int().min(0).max(365);
export const settingsSchema = z
	.object({
		piggyAccountId: z.uuid().nullable(),
		walletId: z.uuid().nullable(),
		categoryId: z.uuid().nullable(),
		smallBelow: z.number().int().min(0).max(1e9),
		largeFrom: z.number().int().min(0).max(1e9),
		smallDays: days,
		midDays: days,
		largeDays: days,
	})
	.refine((s) => s.largeFrom >= s.smallBelow, {
		message: "The top price must be at least the bottom one",
		path: ["largeFrom"],
	});
export type SettingsValues = z.input<typeof settingsSchema>;
