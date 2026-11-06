import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { authAccounts, authSessions, authUsers, db, eq, verificationTokens } from "@seikatsu/db";
import bcrypt from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { currentActor } from "@/lib/actor";
import { authConfig } from "./auth.config";

declare module "next-auth" {
	interface Session {
		user: { id: string } & DefaultSession["user"];
	}
}

const nextAuth = NextAuth({
	...authConfig,
	adapter: DrizzleAdapter(db, {
		usersTable: authUsers,
		accountsTable: authAccounts,
		sessionsTable: authSessions,
		verificationTokensTable: verificationTokens,
	}),
	providers: [
		GitHub({ allowDangerousEmailAccountLinking: true }),
		Google({
			clientId: process.env.GOOGLE_CLIENT_ID ?? "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
			allowDangerousEmailAccountLinking: true,
		}),
		Resend({
			apiKey: process.env.RESEND_API_KEY ?? "",
			from: process.env.AUTH_EMAIL_FROM ?? "seikatsu <noreply@seikatsu.danylomorhun.com>",
		}),
		Credentials({
			async authorize(credentials) {
				const email = credentials.email as string;
				const password = credentials.password as string;
				if (!email || !password) return null;

				const user = await db.query.authUsers.findFirst({
					where: eq(authUsers.email, email),
				});
				if (!user?.passwordHash) return null;

				const valid = await bcrypt.compare(password, user.passwordHash);
				if (!valid) return null;

				return { id: user.id, email: user.email, name: user.name, image: user.image };
			},
		}),
	],
});

export const { handlers, signIn, signOut } = nextAuth;

/**
 * NextAuth's `auth`, except that inside an MCP call (lib/actor.ts) the session is the token's
 * user. Only the no-argument form (read the session) is redirected.
 */
export const auth = ((...args: unknown[]) => {
	const actor = currentActor();
	if (actor && args.length === 0) {
		return Promise.resolve({
			user: { id: actor.userId, name: actor.name },
			expires: new Date(Date.now() + 60_000).toISOString(),
		});
	}
	return (nextAuth.auth as (...a: unknown[]) => unknown)(...args);
}) as typeof nextAuth.auth;
