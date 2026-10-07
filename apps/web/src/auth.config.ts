import type { NextAuthConfig } from "next-auth";

// Edge-safe slice of the auth config: no adapter, no DB, no bcrypt.
// The middleware only decodes the JWT, so it imports this instead of `@/auth`.
export const authConfig = {
	session: { strategy: "jwt" },
	providers: [],
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
} satisfies NextAuthConfig;
