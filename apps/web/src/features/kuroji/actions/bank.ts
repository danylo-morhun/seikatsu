"use server";

import { auth } from "@/auth";
import { syncConnection } from "@/features/kuroji/lib/bank-sync";
import {
	createSession,
	listAspsps,
	newAuthState,
	startAuth,
} from "@/features/kuroji/lib/enablebanking";
import {
	accounts,
	and,
	asc,
	bankAccounts,
	bankConnections,
	bankRules,
	db,
	desc,
	eq,
	workspaces,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

type Result<T = unknown> = { error: string } | ({ success: true } & T);

// Returns an error result if the caller doesn't own the workspace, else null.
async function ownedWorkspace(workspaceId: string): Promise<{ error: string } | null> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);
	if (!ws) return { error: "Workspace not found" };
	if (ws.userId !== session.user.id) return { error: "Forbidden" };
	return null;
}

function callbackUrl() {
	const base = process.env.AUTH_URL ?? "http://localhost:3000";
	return `${base.replace(/\/$/, "")}/api/kuroji/bank/callback`;
}

// ── Institution picker ─────────────────────────────────────────────────────

export async function listBankInstitutions(
	country = "PL",
): Promise<Result<{ institutions: { id: string; name: string; logo?: string }[] }>> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	try {
		const list = await listAspsps(country);
		// Enable Banking identifies an ASPSP by (name, country); use name as the id.
		return {
			success: true,
			institutions: list.map((i) => ({ id: i.name, name: i.name, logo: i.logo })),
		};
	} catch (e) {
		return { error: e instanceof Error ? e.message : "Failed to load banks" };
	}
}

// ── Connect (start consent flow) ────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function connectBank(
	workspaceId: string,
	aspspName: string,
	aspspCountry = "PL",
	importFrom?: string,
): Promise<Result<{ link: string }>> {
	const owner = await ownedWorkspace(workspaceId);
	if (owner) return owner;
	if (importFrom && !ISO_DATE_RE.test(importFrom)) return { error: "Invalid import date" };
	try {
		const state = newAuthState();
		// 90-day access window starts now.
		const validUntil = new Date();
		validUntil.setDate(validUntil.getDate() + 90);

		const { url } = await startAuth({
			aspspName,
			aspspCountry,
			redirectUrl: callbackUrl(),
			state,
			validUntil: validUntil.toISOString(),
		});

		await db.insert(bankConnections).values({
			workspaceId,
			aspspName,
			aspspCountry,
			displayName: aspspName,
			authState: state,
			status: "CREATED",
			accessExpiresAt: validUntil,
			importFromDate: importFrom ?? null,
		});
		revalidatePath("/settings/kuroji");
		return { success: true, link: url };
	} catch (e) {
		return { error: e instanceof Error ? e.message : "Failed to start connection" };
	}
}

// ── Finalize (after bank redirect) — called by the callback route ───────────
// No user session in the callback request, so this is gated by `state` (an
// unguessable per-connection token) plus the bank-supplied authorization code.

export async function finalizeConnection(state: string, code: string): Promise<Result> {
	try {
		const [conn] = await db
			.select()
			.from(bankConnections)
			.where(eq(bankConnections.authState, state))
			.limit(1);
		if (!conn) return { error: "Connection not found" };

		const session = await createSession(code);
		const expires = session.accessValidUntil
			? new Date(session.accessValidUntil)
			: conn.accessExpiresAt;

		await db.transaction(async (tx) => {
			await tx
				.update(bankConnections)
				.set({ status: "LINKED", sessionId: session.sessionId, accessExpiresAt: expires })
				.where(eq(bankConnections.id, conn.id));

			for (const acct of session.accounts) {
				await tx
					.insert(bankAccounts)
					.values({
						connectionId: conn.id,
						accountUid: acct.uid,
						name: acct.name ?? acct.iban ?? acct.uid.slice(0, 8),
						iban: acct.iban ?? null,
						currency: acct.currency ?? null,
					})
					.onConflictDoNothing({ target: bankAccounts.accountUid });
			}
		});

		revalidatePath("/settings/kuroji");
		return { success: true };
	} catch (e) {
		return { error: e instanceof Error ? e.message : "Failed to finalize connection" };
	}
}

// ── Listing for the UI ──────────────────────────────────────────────────────

export async function getBankConnections(workspaceId: string) {
	const owner = await ownedWorkspace(workspaceId);
	if (owner) throw new Error(owner.error);
	return db.query.bankConnections.findMany({
		where: eq(bankConnections.workspaceId, workspaceId),
		orderBy: [desc(bankConnections.createdAt)],
		with: { bankAccounts: true },
	});
}

export async function getBankRules(workspaceId: string) {
	const owner = await ownedWorkspace(workspaceId);
	if (owner) throw new Error(owner.error);
	return db
		.select({
			id: bankRules.id,
			matchText: bankRules.matchText,
			accountId: bankRules.accountId,
			priority: bankRules.priority,
		})
		.from(bankRules)
		.where(eq(bankRules.workspaceId, workspaceId))
		.orderBy(asc(bankRules.priority), asc(bankRules.createdAt));
}

// ── Link a bank account to a Kuroji account ─────────────────────────────────

export async function linkBankAccount(
	workspaceId: string,
	accountUid: string,
	kurojiAccountId: string | null,
): Promise<Result> {
	const owner = await ownedWorkspace(workspaceId);
	if (owner) return owner;

	// Bank account must belong to a connection in this workspace.
	const [ba] = await db
		.select({ connId: bankAccounts.connectionId, wsId: bankConnections.workspaceId })
		.from(bankAccounts)
		.innerJoin(bankConnections, eq(bankAccounts.connectionId, bankConnections.id))
		.where(eq(bankAccounts.accountUid, accountUid))
		.limit(1);
	if (!ba || ba.wsId !== workspaceId) return { error: "Bank account not found" };

	if (kurojiAccountId) {
		const [acct] = await db
			.select({ id: accounts.id, type: accounts.type })
			.from(accounts)
			.where(and(eq(accounts.id, kurojiAccountId), eq(accounts.workspaceId, workspaceId)))
			.limit(1);
		if (!acct) return { error: "Account not found" };
		if (acct.type !== "ASSET" && acct.type !== "LIABILITY") {
			return { error: "Bank accounts must map to an asset or liability account" };
		}
	}

	await db
		.update(bankAccounts)
		.set({ accountId: kurojiAccountId })
		.where(eq(bankAccounts.accountUid, accountUid));
	revalidatePath("/settings/kuroji");
	return { success: true };
}

// ── Sync (manual button) ────────────────────────────────────────────────────

export async function syncBankConnection(
	connectionId: string,
): Promise<Result<{ imported: number; skipped: number }>> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [conn] = await db
		.select()
		.from(bankConnections)
		.where(eq(bankConnections.id, connectionId))
		.limit(1);
	if (!conn) return { error: "Connection not found" };

	const owner = await ownedWorkspace(conn.workspaceId);
	if (owner) return owner;

	try {
		const { imported, skipped } = await syncConnection(conn);
		revalidatePath("/kuroji");
		revalidatePath("/settings/kuroji");
		return { success: true, imported, skipped };
	} catch (e) {
		return { error: e instanceof Error ? e.message : "Sync failed" };
	}
}

// ── Disconnect ────────────────────────────────────────────────────────────────

export async function deleteBankConnection(connectionId: string): Promise<Result> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	const [conn] = await db
		.select({ workspaceId: bankConnections.workspaceId })
		.from(bankConnections)
		.where(eq(bankConnections.id, connectionId))
		.limit(1);
	if (!conn) return { error: "Connection not found" };
	const owner = await ownedWorkspace(conn.workspaceId);
	if (owner) return owner;

	await db.delete(bankConnections).where(eq(bankConnections.id, connectionId));
	revalidatePath("/settings/kuroji");
	return { success: true };
}

// ── Rules CRUD ────────────────────────────────────────────────────────────────

export async function createBankRule(
	workspaceId: string,
	matchText: string,
	accountId: string,
	priority = 0,
): Promise<Result> {
	const owner = await ownedWorkspace(workspaceId);
	if (owner) return owner;
	const text = matchText.trim();
	if (!text) return { error: "Match text required" };

	const [acct] = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(and(eq(accounts.id, accountId), eq(accounts.workspaceId, workspaceId)))
		.limit(1);
	if (!acct) return { error: "Account not found" };

	await db.insert(bankRules).values({ workspaceId, matchText: text, accountId, priority });
	revalidatePath("/settings/kuroji");
	return { success: true };
}

export async function deleteBankRule(ruleId: string): Promise<Result> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	const [rule] = await db
		.select({ workspaceId: bankRules.workspaceId })
		.from(bankRules)
		.where(eq(bankRules.id, ruleId))
		.limit(1);
	if (!rule) return { error: "Rule not found" };
	const owner = await ownedWorkspace(rule.workspaceId);
	if (owner) return owner;

	await db.delete(bankRules).where(eq(bankRules.id, ruleId));
	revalidatePath("/settings/kuroji");
	return { success: true };
}
