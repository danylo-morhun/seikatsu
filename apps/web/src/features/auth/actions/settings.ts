"use server";

import { auth, signOut } from "@/auth";
import { sendEmailChangeVerification } from "@/features/auth/lib/email";
import { and, authAccounts, authUsers, db, eq, verificationTokens, workspaces } from "@seikatsu/db";
import { put } from "@vercel/blob";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type SettingsState = { error: string } | { success: true } | null;

async function requireUser() {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not authenticated");
	return session.user;
}

export async function updateProfile(
	_prev: SettingsState,
	formData: FormData,
): Promise<SettingsState> {
	const user = await requireUser();

	const parsedName = z.string().min(1, "Name is required").max(100).safeParse(formData.get("name"));
	if (!parsedName.success) return { error: parsedName.error.issues[0]?.message ?? "Invalid name" };

	let imageUrl: string | null = null;

	const avatarFile = formData.get("avatarFile");
	if (avatarFile instanceof File && avatarFile.size > 0) {
		if (!avatarFile.type.startsWith("image/")) return { error: "Only image files are allowed." };
		if (avatarFile.size > 2 * 1024 * 1024) return { error: "Image must be under 2 MB." };
		const { url } = await put(`avatars/${user.id}/${avatarFile.name}`, avatarFile, {
			access: "public",
		});
		imageUrl = url;
	} else {
		const raw = formData.get("image");
		const parsed = z
			.union([z.string().url(), z.literal("")])
			.optional()
			.safeParse(typeof raw === "string" ? raw : "");
		if (!parsed.success) return { error: "Invalid image URL." };
		imageUrl = parsed.data || null;
	}

	await db
		.update(authUsers)
		.set({ name: parsedName.data, image: imageUrl })
		.where(eq(authUsers.id, user.id));
	revalidatePath("/settings/account");
	return { success: true };
}

export async function changePassword(
	_prev: SettingsState,
	formData: FormData,
): Promise<SettingsState> {
	const user = await requireUser();
	const dbUser = await db.query.authUsers.findFirst({
		where: eq(authUsers.id, user.id),
		columns: { passwordHash: true },
	});

	if (dbUser?.passwordHash) {
		const schema = z.object({
			currentPassword: z.string().min(1, "Current password is required"),
			newPassword: z.string().min(8, "Password must be at least 8 characters"),
		});
		const parsed = schema.safeParse({
			currentPassword: formData.get("currentPassword"),
			newPassword: formData.get("newPassword"),
		});
		if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
		const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash);
		if (!valid) return { error: "Current password is incorrect" };
		const hash = await bcrypt.hash(parsed.data.newPassword, 12);
		await db.update(authUsers).set({ passwordHash: hash }).where(eq(authUsers.id, user.id));
	} else {
		const schema = z.object({
			newPassword: z.string().min(8, "Password must be at least 8 characters"),
		});
		const parsed = schema.safeParse({ newPassword: formData.get("newPassword") });
		if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
		const hash = await bcrypt.hash(parsed.data.newPassword, 12);
		await db.update(authUsers).set({ passwordHash: hash }).where(eq(authUsers.id, user.id));
	}

	return { success: true };
}

export async function unlinkProvider(
	_prev: SettingsState,
	formData: FormData,
): Promise<SettingsState> {
	const user = await requireUser();
	const provider = formData.get("provider") as string;
	if (!provider) return { error: "Provider is required" };

	const [accounts, dbUser] = await Promise.all([
		db.query.authAccounts.findMany({
			where: eq(authAccounts.userId, user.id),
			columns: { provider: true },
		}),
		db.query.authUsers.findFirst({
			where: eq(authUsers.id, user.id),
			columns: { passwordHash: true },
		}),
	]);

	const remainingProviders = accounts.filter((a) => a.provider !== provider);
	if (remainingProviders.length === 0 && !dbUser?.passwordHash) {
		return { error: "Cannot unlink the only sign-in method" };
	}

	await db
		.delete(authAccounts)
		.where(and(eq(authAccounts.userId, user.id), eq(authAccounts.provider, provider)));
	revalidatePath("/settings");
	return { success: true };
}

export async function signOutAllDevices(): Promise<never> {
	const user = await requireUser();
	await db.update(authUsers).set({ forceSignOutAt: new Date() }).where(eq(authUsers.id, user.id));
	await signOut({ redirectTo: "/" });
	throw new Error("unreachable");
}

export async function deleteAccount(): Promise<never> {
	const user = await requireUser();
	const workspace = await db.query.workspaces.findFirst({
		where: eq(workspaces.userId, user.id),
		columns: { id: true },
	});
	await db.transaction(async (tx) => {
		if (workspace) {
			await tx.delete(workspaces).where(eq(workspaces.id, workspace.id));
		}
		await tx.delete(authUsers).where(eq(authUsers.id, user.id));
	});
	await signOut({ redirectTo: "/" });
	throw new Error("unreachable");
}

export async function requestEmailChange(
	_prev: SettingsState,
	formData: FormData,
): Promise<SettingsState> {
	const user = await requireUser();
	const parsed = z.string().email().safeParse(formData.get("newEmail"));
	if (!parsed.success) return { error: "Invalid email address" };
	const newEmail = parsed.data;

	if (newEmail === user.email) return { error: "That is already your current email" };

	const existing = await db.query.authUsers.findFirst({
		where: eq(authUsers.email, newEmail),
		columns: { id: true },
	});
	if (existing) return { error: "Email already in use by another account" };

	const token = crypto.randomUUID();
	const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
	const identifier = `email-change:${user.id}`;

	await db.transaction(async (tx) => {
		await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
		await tx.insert(verificationTokens).values({ identifier, token, expires });
		await tx.update(authUsers).set({ pendingEmail: newEmail }).where(eq(authUsers.id, user.id));
	});

	const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
	await sendEmailChangeVerification(
		newEmail,
		`${base}/auth/verify-email-change?token=${token}&uid=${user.id}`,
	);

	return { success: true };
}
