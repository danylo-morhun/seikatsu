import type { NextRequest } from "next/server";
import { json, preflight, readParams } from "@/features/mcp/lib/http";
import { revokeByToken } from "@/features/mcp/lib/oauth";

// RFC 7009: always 200, known token or not.
export async function POST(req: NextRequest) {
	const { token } = await readParams(req);
	if (token) await revokeByToken(token);
	return json({});
}

export const OPTIONS = preflight;
