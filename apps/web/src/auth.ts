import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { authAccounts, authSessions, authUsers, db, eq, verificationTokens } from "@seikatsu/db";
import bcrypt from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

declare module "next-auth" {
	interface Session {
		user: { id: string } & DefaultSession["user"];
	}
}

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: DrizzleAdapter(db, {
		usersTable: authUsers,
		accountsTable: authAccounts,
		sessionsTable: authSessions,
		verificationTokensTable: verificationTokens,
	}),
	session: { strategy: "jwt" },
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
	callbacks: {
		jwt({ token, user }) {
			if (user?.id) token.sub = user.id;
			return token;
		},
		session({ session, token }) {
			if (token.sub) session.user.id = token.sub;
			return session;
		},
	},
	pages: {
		signIn: "/",
		verifyRequest: "/auth/verify",
	},
});
