import { relations } from "drizzle-orm";
import {
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

export const tsundokuBookStatusEnum = pgEnum("tsundoku_book_status", [
	"want",
	"reading",
	"read",
	"dnf",
	"paused",
]);

export const tsundokuBooks = pgTable(
	"tsundoku_books",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		authors: text("authors").array(),
		isbn: text("isbn"),
		coverUrl: text("cover_url"),
		olKey: text("ol_key"),
		pageCount: integer("page_count"),
		publishedYear: integer("published_year"),
		description: text("description"),
		genre: text("genre"),
		seriesName: text("series_name"),
		seriesPosition: integer("series_position"),
		source: text("source").notNull().default("openlibrary"),
		status: tsundokuBookStatusEnum("status").notNull().default("want"),
		rating: integer("rating"),
		review: text("review"),
		currentPage: integer("current_page").notNull().default(0),
		startedAt: date("started_at"),
		finishedAt: date("finished_at"),
		position: varchar("position", { length: 255 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("tsundoku_books_workspace_id_idx").on(t.workspaceId)],
);

export const tsundokuShelves = pgTable(
	"tsundoku_shelves",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color"),
		position: varchar("position", { length: 255 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("tsundoku_shelves_workspace_id_idx").on(t.workspaceId)],
);

export const tsundokuBookShelves = pgTable(
	"tsundoku_book_shelves",
	{
		bookId: uuid("book_id")
			.notNull()
			.references(() => tsundokuBooks.id, { onDelete: "cascade" }),
		shelfId: uuid("shelf_id")
			.notNull()
			.references(() => tsundokuShelves.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({ columns: [t.bookId, t.shelfId] }),
		index("tsundoku_book_shelves_book_id_idx").on(t.bookId),
		index("tsundoku_book_shelves_shelf_id_idx").on(t.shelfId),
	],
);

export const tsundokuSessions = pgTable(
	"tsundoku_sessions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		bookId: uuid("book_id")
			.notNull()
			.references(() => tsundokuBooks.id, { onDelete: "cascade" }),
		date: date("date").notNull(),
		pagesRead: integer("pages_read").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("tsundoku_sessions_book_id_idx").on(t.bookId)],
);

export const tsundokuQuotes = pgTable(
	"tsundoku_quotes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		bookId: uuid("book_id")
			.notNull()
			.references(() => tsundokuBooks.id, { onDelete: "cascade" }),
		page: integer("page"),
		text: text("text").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("tsundoku_quotes_book_id_idx").on(t.bookId)],
);

export const tsundokuGoals = pgTable(
	"tsundoku_goals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		year: integer("year").notNull(),
		targetBooks: integer("target_books").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("tsundoku_goals_workspace_year_idx").on(t.workspaceId, t.year)],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const tsundokuBooksRelations = relations(tsundokuBooks, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [tsundokuBooks.workspaceId],
		references: [workspaces.id],
	}),
	sessions: many(tsundokuSessions),
	quotes: many(tsundokuQuotes),
	bookShelves: many(tsundokuBookShelves),
}));

export const tsundokuShelvesRelations = relations(tsundokuShelves, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [tsundokuShelves.workspaceId],
		references: [workspaces.id],
	}),
	bookShelves: many(tsundokuBookShelves),
}));

export const tsundokuBookShelvesRelations = relations(tsundokuBookShelves, ({ one }) => ({
	book: one(tsundokuBooks, {
		fields: [tsundokuBookShelves.bookId],
		references: [tsundokuBooks.id],
	}),
	shelf: one(tsundokuShelves, {
		fields: [tsundokuBookShelves.shelfId],
		references: [tsundokuShelves.id],
	}),
}));

export const tsundokuSessionsRelations = relations(tsundokuSessions, ({ one }) => ({
	book: one(tsundokuBooks, {
		fields: [tsundokuSessions.bookId],
		references: [tsundokuBooks.id],
	}),
}));

export const tsundokuQuotesRelations = relations(tsundokuQuotes, ({ one }) => ({
	book: one(tsundokuBooks, {
		fields: [tsundokuQuotes.bookId],
		references: [tsundokuBooks.id],
	}),
}));
