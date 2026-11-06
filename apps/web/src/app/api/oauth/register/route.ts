import { count, db, gt, mcpClients } from "@seikatsu/db";
import type { NextRequest } from "next/server";
import { json, preflight } from "@/features/mcp/lib/http";
import { isAllowedRedirect, registerClient, registrationSchema } from "@/features/mcp/lib/oauth";

// RFC 7591 dynamic registration: claude.ai and Claude Code register themselves before the
// first sign-in. Open by design (a client is only a name + redirect list; nothing is granted
// until the user says Allow), so it's capped per hour against floods.
const HOURLY_CAP = 30;

export async function POST(req: NextRequest) {
	const parsed = registrationSchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) {
		return json({ error: "invalid_client_metadata", error_description: "Bad metadata" }, 400);
	}
	if (!parsed.data.redirect_uris.every(isAllowedRedirect)) {
		return json(
			{ error: "invalid_redirect_uri", error_description: "https, or http to localhost only" },
			400,
		);
	}
	const [{ recent }] = await db
		.select({ recent: count() })
		.from(mcpClients)
		.where(gt(mcpClients.createdAt, new Date(Date.now() - 60 * 60 * 1000)));
	if (recent >= HOURLY_CAP) {
		return json({ error: "temporarily_unavailable", error_description: "Try again later" }, 429);
	}

	const client = await registerClient(parsed.data);
	return json(
		{
			client_id: client.id,
			client_name: client.name,
			client_id_issued_at: Math.floor(Date.now() / 1000),
			redirect_uris: parsed.data.redirect_uris,
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		},
		201,
	);
}

export const OPTIONS = preflight;
