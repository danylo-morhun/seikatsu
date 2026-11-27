import {
	boolean,
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	time,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

export const calendarRepeatEnum = pgEnum("calendar_repeat", ["day", "week", "month", "year"]);

/**
 * The user's own events on the home's calendar: a dentist at 15:00, a trip over three days, a
 * birthday every year. Times are the user's wall clock (like a card's due time); no time = all
 * day. A repeating event is one row; its days are worked out when read.
 */
export const calendarEvents = pgTable(
	"calendar_events",
	{
		/** Made on the device, so an event saved offline can be edited before it syncs. */
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		/** The first day. */
		date: date("date").notNull(),
		/** The last day of an event over several days (inclusive); null = one day. */
		endDate: date("end_date"),
		/** Null = all day. */
		startTime: time("start_time"),
		/** Null with a start = an hour. */
		endTime: time("end_time"),
		/** Repeats every `repeatEvery` of these from `date`; null = once. */
		repeat: calendarRepeatEnum("repeat"),
		repeatEvery: integer("repeat_every").notNull().default(1),
		/** The last day it repeats on (inclusive); null = for good. */
		repeatUntil: date("repeat_until"),
		/** Ends after this many times (counted from `date`, skipped ones included); null = no count. */
		repeatCount: integer("repeat_count"),
		/** Weekly: the weekdays it falls on (1 = Monday … 7 = Sunday); null = `date`'s own. */
		repeatDays: integer("repeat_days").array(),
		/** Monthly: on `date`'s weekday in the same week of the month (the 2nd Tuesday, the last
		 * Friday) instead of the same day number. */
		repeatByWeekday: boolean("repeat_by_weekday").notNull().default(false),
		/** Days of a repeating event taken out (deleted or changed apart): its start days. */
		skip: date("skip").array().notNull().default([]),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("calendar_events_workspace_date_idx").on(t.workspaceId, t.date)],
);

export type CalendarEvent = typeof calendarEvents.$inferSelect;
