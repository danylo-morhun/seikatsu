import { Card, CardContent } from "@seikatsu/ui/card";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInCard } from "@/features/auth/components/SignInCard";
import { ConsentCard } from "@/features/mcp/components/ConsentCard";
import {
	AUTHORIZE_PARAMS,
	type AuthorizeParams,
	checkAuthorize,
} from "@/features/mcp/lib/authorize";
import { originOf } from "@/features/mcp/lib/oauth";

export const metadata = { title: "Connect to seikatsu" };

// OAuth consent for an MCP client (claude.ai, Claude Code). Signed out → sign in here and
// come straight back; then Allow / Deny (features/mcp/actions/consent.ts).
export default async function AuthorizePage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const raw = await searchParams;
	const params: AuthorizeParams = Object.fromEntries(
		AUTHORIZE_PARAMS.flatMap((k) => (typeof raw[k] === "string" ? [[k, raw[k]]] : [])),
	);
	const origin = originOf(await headers());
	const check = await checkAuthorize(params, origin);
	if ("redirect" in check) redirect(check.redirect);

	if ("fatal" in check) {
		return (
			<main className="flex min-h-screen items-center justify-center p-4">
				<Card className="w-full max-w-sm">
					<CardContent className="space-y-2 p-6 text-center">
						<h1 className="text-base font-semibold">Can't connect</h1>
						<p className="text-muted-foreground text-sm">{check.fatal}</p>
					</CardContent>
				</Card>
			</main>
		);
	}

	const session = await auth();
	if (!session) {
		const back = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>)}`;
		return (
			<main className="flex min-h-screen items-center justify-center p-4">
				<SignInCard returnTo={back} />
			</main>
		);
	}

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<ConsentCard
				params={params}
				clientName={check.ok.clientName}
				redirectHost={new URL(check.ok.redirectUri).host}
				offersWrite={check.ok.scopes.includes("write")}
				who={session.user?.email ?? session.user?.name ?? ""}
			/>
		</main>
	);
}
