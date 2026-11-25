import {
	boolean,
	date,
	index,
	pgTable,
	primaryKey,
	text,
	time,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

/**
 * A Google account connected for its calendars (one per workspace), apart from signing in:
 * its own consent with the calendar scope. Tokens are sealed (AES-GCM, see web lib/seal.ts).
 */
export const googleAccounts = pgTable("google_accounts", {
	workspaceId: uuid("workspace_id")
		.primaryKey()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	email: text("email").notNull(),
	refreshToken: text("refresh_token").notNull(),
	accessToken: text("access_token"),
	accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
	/** The user's zone when they last used it: Google's times are read and written in it. */
	timeZone: text("time_zone").notNull().default("UTC"),
	/** The calendar seikatsu writes its own rows to ("seikatsu"), made on connect. */
	ownCalendarId: text("own_calendar_id"),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Each of the account's calendars, shown on seikatsu's calendar or not. */
export const googleCalendars = pgTable(
	"google_calendars",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => googleAccounts.workspaceId, { onDelete: "cascade" }),
		googleId: text("google_id").notNull(),
		name: text("name").notNull(),
		/** Google's colour for it, "#rrggbb". */
		color: text("color"),
		shown: boolean("shown").notNull().default(true),
		/** The user can change its events (owner or writer). */
		writable: boolean("writable").notNull().default(false),
		/** seikatsu's own calendar: its rows, mirrored; not shown again as a layer. */
		own: boolean("own").notNull().default(false),
		/** The push channel Google tells about changes on, while it lasts. */
		channelId: text("channel_id"),
		channelResourceId: text("channel_resource_id"),
		channelToken: text("channel_token"),
		channelExpiresAt: timestamp("channel_expires_at", { withTimezone: true }),
	},
	(t) => [
		uniqueIndex("google_calendars_workspace_google_idx").on(t.workspaceId, t.googleId),
		index("google_calendars_channel_idx").on(t.channelId),
	],
);

/**
 * Google's events in a window around today, kept so the calendar reads them without asking
 * Google on every page. Times are on the user's clock (converted when pulled); a repeating
 * event is one row per day it falls on.
 */
export const googleEvents = pgTable(
	"google_events",
	{
		calendarId: uuid("calendar_id")
			.notNull()
			.references(() => googleCalendars.id, { onDelete: "cascade" }),
		googleId: text("google_id").notNull(),
		workspaceId: uuid("workspace_id").notNull(),
		title: text("title").notNull(),
		date: date("date").notNull(),
		/** Last day (inclusive) of one over several days; null = one day. */
		endDate: date("end_date"),
		/** Null = all day. */
		startTime: time("start_time"),
		endTime: time("end_time"),
		location: text("location"),
		note: text("note"),
		link: text("link"),
		/** One day of a repeating event: changes apply to that day only. */
		recurring: boolean("recurring").notNull().default(false),
	},
	(t) => [
		primaryKey({ columns: [t.calendarId, t.googleId] }),
		index("google_events_workspace_date_idx").on(t.workspaceId, t.date),
	],
);

/**
 * What seikatsu has written to its own Google calendar, by its row key (`event:<id>`,
 * `seiryu:<card id>`…): the Google event, what was sent (hash), and Google's `updated` stamp
 * then — a later stamp means the user changed it in Google.
 */
export const googleMirror = pgTable(
	"google_mirror",
	{
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => googleAccounts.workspaceId, { onDelete: "cascade" }),
		key: text("key").notNull(),
		googleId: text("google_id").notNull(),
		/** The row's day, so rows that leave the window are let be. */
		date: date("date").notNull(),
		hash: text("hash").notNull(),
		updated: text("updated").notNull(),
	},
	(t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);
