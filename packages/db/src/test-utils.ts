import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");

// In-memory Postgres (PGlite) with the real migrations applied. For unit tests
// that need actual DB-transaction semantics without a network Postgres instance.
//
// Runs each migration file's raw SQL through PGlite's simple query protocol
// (client.exec) rather than drizzle-orm/pglite's migrator, which sends each
// "--> statement-breakpoint" chunk through the extended/prepared-statement
// protocol — that breaks on 0004_rename_tasso_to_seiryu.sql, whose chunks
// contain several statements without breakpoints between them.
export async function createTestDb() {
	const client = new PGlite();
	const journal = JSON.parse(
		fs.readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf-8"),
	) as { entries: { tag: string }[] };
	for (const entry of journal.entries) {
		const sql = fs.readFileSync(path.join(migrationsFolder, `${entry.tag}.sql`), "utf-8");
		await client.exec(sql);
	}
	return drizzle(client, { schema });
}
