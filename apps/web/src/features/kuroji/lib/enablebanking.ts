// Enable Banking API client. https://enablebanking.com/docs/api/
//
// Free for personal use via "Restricted Production" (your own whitelisted
// accounts). Auth is a per-request JWT (RS256) signed with the RSA private key
// generated when you register an application in the Control Panel.
//
// Env:
//   ENABLE_BANKING_APP_ID       — application id (the .pem filename → JWT `kid`)
//   ENABLE_BANKING_PRIVATE_KEY  — the RSA private key PEM (newlines as \n)

import { createSign, randomUUID } from "node:crypto";

const BASE = "https://api.enablebanking.com";

function base64url(input: Buffer | string): string {
	return Buffer.from(input).toString("base64url");
}

// Build + sign a short-lived (1h) JWT for the Authorization header.
function getJwt(): string {
	const appId = process.env.ENABLE_BANKING_APP_ID;
	const pem = process.env.ENABLE_BANKING_PRIVATE_KEY?.replace(/\\n/g, "\n");
	if (!appId || !pem) {
		throw new Error("ENABLE_BANKING_APP_ID / ENABLE_BANKING_PRIVATE_KEY not configured");
	}
	const header = { typ: "JWT", alg: "RS256", kid: appId };
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		iss: "enablebanking.com",
		aud: "api.enablebanking.com",
		iat: now,
		exp: now + 3600,
	};
	const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
	const signer = createSign("RSA-SHA256");
	signer.update(signingInput);
	signer.end();
	const signature = signer.sign(pem);
	return `${signingInput}.${base64url(signature)}`;
}

function timeout(ms: number) {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), ms);
	return { signal: controller.signal, done: () => clearTimeout(id) };
}

async function ebFetch<T>(
	path: string,
	init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
	const { timeoutMs = 15000, headers, ...rest } = init;
	const t = timeout(timeoutMs);
	let res: Response;
	try {
		res = await fetch(`${BASE}${path}`, {
			...rest,
			headers: {
				Authorization: `Bearer ${getJwt()}`,
				"Content-Type": "application/json",
				...headers,
			},
			signal: t.signal,
		});
	} finally {
		t.done();
	}
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`EnableBanking ${res.status} ${path}: ${body.slice(0, 300)}`);
	}
	return (await res.json()) as T;
}

// ── ASPSPs (banks) ──────────────────────────────────────────────────────────

export type Aspsp = { name: string; country: string; logo?: string };

export async function listAspsps(country = "PL"): Promise<Aspsp[]> {
	const data = await ebFetch<{ aspsps: Aspsp[] }>(`/aspsps?country=${country}`);
	return data.aspsps ?? [];
}

// ── Authorization ─────────────────────────────────────────────────────────────

export type StartAuthResult = { url: string; authorizationId?: string };

export async function startAuth(opts: {
	aspspName: string;
	aspspCountry: string;
	redirectUrl: string;
	state: string;
	validUntil: string; // ISO timestamp
}): Promise<StartAuthResult> {
	const data = await ebFetch<{ url: string; authorization_id?: string }>("/auth", {
		method: "POST",
		body: JSON.stringify({
			access: { valid_until: opts.validUntil },
			aspsp: { name: opts.aspspName, country: opts.aspspCountry },
			state: opts.state,
			redirect_url: opts.redirectUrl,
			psu_type: "personal",
		}),
	});
	return { url: data.url, authorizationId: data.authorization_id };
}

export function newAuthState(): string {
	return randomUUID();
}

// ── Session ─────────────────────────────────────────────────────────────────

// `accounts` may be a list of uid strings or richer objects depending on bank.
export type SessionAccount = {
	uid: string;
	iban?: string;
	name?: string;
	currency?: string;
};

export type SessionResult = {
	sessionId: string;
	accounts: SessionAccount[];
	accessValidUntil?: string;
};

type RawAccount =
	| string
	| {
			uid?: string;
			account_id?: { iban?: string };
			iban?: string;
			name?: string;
			product?: string;
			currency?: string;
	  };

function normalizeAccount(raw: RawAccount): SessionAccount {
	if (typeof raw === "string") return { uid: raw };
	const iban = raw.account_id?.iban ?? raw.iban;
	return {
		uid: raw.uid ?? iban ?? "",
		iban,
		name: raw.name ?? raw.product,
		currency: raw.currency,
	};
}

export async function createSession(code: string): Promise<SessionResult> {
	const data = await ebFetch<{
		session_id: string;
		accounts: RawAccount[];
		access?: { valid_until?: string };
	}>("/sessions", {
		method: "POST",
		body: JSON.stringify({ code }),
	});
	return {
		sessionId: data.session_id,
		accounts: (data.accounts ?? []).map(normalizeAccount).filter((a) => a.uid),
		accessValidUntil: data.access?.valid_until,
	};
}

// ── Transactions ──────────────────────────────────────────────────────────────

export type EbTransaction = {
	entry_reference?: string;
	transaction_amount: { amount: string; currency: string };
	credit_debit_indicator?: "CRDT" | "DBIT";
	status?: string; // "BOOK" | "PDNG"
	booking_date?: string;
	value_date?: string;
	transaction_date?: string;
	remittance_information?: string[];
	creditor?: { name?: string };
	debtor?: { name?: string };
};

// Fetch booked transactions, following continuation keys until exhausted.
export async function getAccountTransactions(
	accountUid: string,
	dateFrom?: string,
): Promise<EbTransaction[]> {
	const all: EbTransaction[] = [];
	let continuationKey: string | undefined;
	do {
		const params = new URLSearchParams();
		if (dateFrom) params.set("date_from", dateFrom);
		params.set("transaction_status", "BOOK");
		if (continuationKey) params.set("continuation_key", continuationKey);
		const data = await ebFetch<{
			transactions: EbTransaction[];
			continuation_key?: string;
		}>(`/accounts/${accountUid}/transactions?${params.toString()}`, { timeoutMs: 25000 });
		all.push(...(data.transactions ?? []));
		continuationKey = data.continuation_key;
	} while (continuationKey);
	return all;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function ebTransactionExternalId(t: EbTransaction): string | null {
	if (t.entry_reference) return t.entry_reference;
	// Fallback synthetic key when the bank omits a reference.
	const date = ebTransactionDate(t);
	if (!date) return null;
	const remittance = (t.remittance_information ?? []).join(" ");
	return `${date}|${t.transaction_amount.amount}|${t.credit_debit_indicator ?? ""}|${remittance}`.slice(
		0,
		200,
	);
}

export function ebTransactionDate(t: EbTransaction): string | null {
	return t.booking_date ?? t.value_date ?? t.transaction_date ?? null;
}

export function ebTransactionDescription(t: EbTransaction): string {
	const remittance = (t.remittance_information ?? []).join(" ");
	const party = t.creditor?.name ?? t.debtor?.name ?? "";
	return [party, remittance].filter(Boolean).join(" — ").trim() || "Bank transaction";
}

// CRDT = money in (inflow); DBIT = money out (outflow).
export function ebTransactionIsInflow(t: EbTransaction): boolean {
	return t.credit_debit_indicator === "CRDT";
}
