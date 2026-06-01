import { authUsers, db, eq, verificationTokens } from "@seikatsu/db";
import { and } from "@seikatsu/db";
import { Card, CardContent, CardHeader, CardTitle } from "@seikatsu/ui/card";
import Link from "next/link";

interface Props {
	searchParams: Promise<{ token?: string; uid?: string }>;
}

export default async function VerifyEmailChangePage({ searchParams }: Props) {
	const { token, uid } = await searchParams;

	if (!token || !uid) {
		return <Result error="Invalid link." />;
	}

	const identifier = `email-change:${uid}`;
	const record = await db.query.verificationTokens.findFirst({
		where: and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)),
	});

	if (!record) {
		return <Result error="Link is invalid or already used." />;
	}

	if (record.expires < new Date()) {
		await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
		return <Result error="Link has expired. Request a new one from settings." />;
	}

	const user = await db.query.authUsers.findFirst({
		where: eq(authUsers.id, uid),
		columns: { pendingEmail: true },
	});

	if (!user?.pendingEmail) {
		return <Result error="No pending email change found." />;
	}

	await db.transaction(async (tx) => {
		await tx
			.update(authUsers)
			.set({ email: user.pendingEmail!, pendingEmail: null })
			.where(eq(authUsers.id, uid));
		await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
	});

	return <Result success={`Email updated to ${user.pendingEmail}.`} />;
}

function Result({ error, success }: { error?: string; success?: string }) {
	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-sm text-center">
				<CardHeader>
					<CardTitle>{error ? "Verification failed" : "Email updated"}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-sm text-muted-foreground">{error ?? success}</p>
					<Link href="/settings" className="text-sm underline underline-offset-2">
						Back to settings
					</Link>
				</CardContent>
			</Card>
		</main>
	);
}
