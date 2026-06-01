"use server";

import { sendPasswordResetEmail } from "@/features/auth/lib/email";
import { authUsers, db, eq, verificationTokens } from "@seikatsu/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

export type ResetState = { error: string } | { success: true } | null;

export async function requestPasswordReset(
	_prev: ResetState,
	formData: FormData,
): Promise<ResetState> {
	const parsed = z.string().email().safeParse(formData.get("email"));
	if (!parsed.success) return { error: "Invalid email address" };
	const email = parsed.data;

	const user = await db.query.authUsers.findFirst({
		where: eq(authUsers.email, email),
		columns: { id: true, passwordHash: true },
	});

	// Always return success to avoid email enumeration
	if (!user?.passwordHash) return { success: true };

	const token = crypto.randomUUID();
	const identifier = `pwd-reset:${email}`;
	const expires = new Date(Date.now() + 60 * 60 * 1000);

	await db.transaction(async (tx) => {
		await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
		await tx.insert(verificationTokens).values({ identifier, token, expires });
	});

	const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
	await sendPasswordResetEmail(
		email,
		`${base}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`,
	);

	return { success: true };
}

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
	const schema = z.object({
		email: z.string().email(),
		token: z.string().min(1),
		password: z.string().min(8, "Password must be at least 8 characters"),
	});
	const parsed = schema.safeParse({
		email: formData.get("email"),
		token: formData.get("token"),
		password: formData.get("password"),
	});
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { email, token, password } = parsed.data;
	const identifier = `pwd-reset:${email}`;

	const record = await db.query.verificationTokens.findFirst({
		where: eq(verificationTokens.identifier, identifier),
	});

	if (!record || record.token !== token) return { error: "Invalid or expired reset link" };
	if (record.expires < new Date()) {
		await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
		return { error: "Reset link has expired. Request a new one." };
	}

	const user = await db.query.authUsers.findFirst({
		where: eq(authUsers.email, email),
		columns: { id: true },
	});
	if (!user) return { error: "Account not found" };

	const hash = await bcrypt.hash(password, 12);
	await db.transaction(async (tx) => {
		await tx.update(authUsers).set({ passwordHash: hash }).where(eq(authUsers.id, user.id));
		await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
	});

	return { success: true };
}
