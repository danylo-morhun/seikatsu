"use server";

import { auth } from "@/auth";
import {
	accounts,
	and,
	db,
	eq,
	lte,
	sql,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";

export type NetWorthPoint = {
	month: string;
	netWorth: number;
};

export async function getNetWorthHistory(
	workspaceId: string,
	months = 12,
): Promise<NetWorthPoint[]> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) throw new Error("Forbidden");

	const cutoff = new Date();
	cutoff.setDate(1);
	cutoff.setMonth(cutoff.getMonth() - (months - 1));
	const cutoffDate = cutoff.toISOString().slice(0, 10);

	const rows = await db
		.select({
			month: sql<string>`to_char(date_trunc('month', generate_series), 'YYYY-MM')`,
			netWorth: sql<string>`coalesce((
        select sum(te.base_amount)
        from ${transactionEntries} te
        join ${transactions} t on t.id = te.transaction_id
        join ${accounts} a on a.id = te.account_id
        where a.workspace_id = ${workspaceId}
          and a.type in ('ASSET', 'LIABILITY')
          and a.archived_at is null
          and t.date <= (date_trunc('month', generate_series) + interval '1 month' - interval '1 day')::date
      ), 0)`,
		})
		.from(
			sql`generate_series(
        ${cutoffDate}::date,
        date_trunc('month', current_date)::date,
        '1 month'::interval
      ) as generate_series`,
		);

	return rows.map((r) => ({ month: r.month, netWorth: Number(r.netWorth) }));
}
