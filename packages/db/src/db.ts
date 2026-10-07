import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// One small pool per function instance. Fluid compute reuses instances across requests,
// so connections stay warm; idle ones close after 20s. Keep prepared statements on —
// disabling them (e.g. for PgBouncer) costs an extra round trip per query.
const client = postgres(process.env.DATABASE_URL!, {
	max: 5,
	idle_timeout: 20,
	connect_timeout: 10,
});

export const db = drizzle(client, { schema });
