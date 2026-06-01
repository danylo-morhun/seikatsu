"use server";

import { signIn, signOut } from "@/auth";
import { authUsers, db, eq } from "@seikatsu/db";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";

export type AuthState = { error: string } | { success: true } | null;

export async function signOutAction() {
	await signOut({ redirectTo: "/" });
}

export async function signInWithGitHub() {
	await signIn("github", { redirectTo: "/kuroji" });
}

export async function signInWithGoogle() {
	await signIn("google", { redirectTo: "/kuroji" });
}

export async function signInWithMagicLink(
	_prev: AuthState,
	formData: FormData,
): Promise<AuthState> {
	const email = formData.get("email");
	const parsed = z.string().email().safeParse(email);
	if (!parsed.success) return { error: "Invalid email" };
	try {
		await signIn("resend", { email: parsed.data, redirectTo: "/kuroji" });
	} catch (e) {
		if (e instanceof AuthError) return { error: "Failed to send magic link" };
		throw e;
	}
	return { success: true };
}

export async function handleCredentials(_prev: AuthState, formData: FormData): Promise<AuthState> {
	const mode = formData.get("mode") as "signin" | "signup";

	if (mode === "signup") {
		const schema = z.object({
			name: z.string().min(1),
			email: z.string().email(),
			password: z.string().min(8),
		});
		const parsed = schema.safeParse({
			name: formData.get("name"),
			email: formData.get("email"),
			password: formData.get("password"),
		});
		if (!parsed.success) {
			const msg = parsed.error.issues[0]?.message ?? "Invalid input";
			return { error: msg };
		}
		const { name, email, password } = parsed.data;

		const existing = await db.query.authUsers.findFirst({ where: eq(authUsers.email, email) });
		if (existing) return { error: "Email already in use" };

		const passwordHash = await bcrypt.hash(password, 12);
		await db.insert(authUsers).values({
			id: crypto.randomUUID(),
			email,
			name,
			passwordHash,
		});
	}

	try {
		await signIn("credentials", {
			email: formData.get("email"),
			password: formData.get("password"),
			redirectTo: "/kuroji",
		});
	} catch (e) {
		if (e instanceof AuthError) {
			if (e.type === "CredentialsSignin") return { error: "Invalid email or password" };
			return { error: "Something went wrong" };
		}
		throw e;
	}
	return { success: true };
}
