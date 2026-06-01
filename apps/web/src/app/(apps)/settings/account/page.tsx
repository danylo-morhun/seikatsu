import { auth } from "@/auth";
import { ChangeEmailForm } from "@/features/auth/components/ChangeEmailForm";
import { ChangePasswordForm } from "@/features/auth/components/ChangePasswordForm";
import { DangerZone } from "@/features/auth/components/DangerZone";
import { LinkedProviders } from "@/features/auth/components/LinkedProviders";
import { ProfileForm } from "@/features/auth/components/ProfileForm";
import { authAccounts, authUsers, db, eq } from "@seikatsu/db";
import { Separator } from "@seikatsu/ui";
import { redirect } from "next/navigation";

export default async function AccountSettingsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const [dbUser, accounts] = await Promise.all([
		db.query.authUsers.findFirst({ where: eq(authUsers.id, session.user.id) }),
		db.query.authAccounts.findMany({
			where: eq(authAccounts.userId, session.user.id),
			columns: { provider: true },
		}),
	]);

	if (!dbUser) redirect("/");

	const providers = accounts.map((a) => a.provider);

	return (
		<main className="px-4 py-6 sm:px-6 max-w-3xl">
			<h1 className="mb-8 text-2xl font-semibold">Account</h1>

			<section className="mb-10">
				<h2 className="mb-1 text-base font-semibold">Profile</h2>
				<p className="mb-4 text-sm text-muted-foreground">Your display name and avatar.</p>
				<ProfileForm name={dbUser.name} image={dbUser.image} />
			</section>

			<Separator className="my-8" />

			<section className="mb-10">
				<h2 className="mb-1 text-base font-semibold">Email address</h2>
				<p className="mb-4 text-sm text-muted-foreground">
					Current: <span className="font-medium text-foreground">{dbUser.email}</span>
				</p>
				<ChangeEmailForm currentEmail={dbUser.email} pendingEmail={dbUser.pendingEmail ?? null} />
			</section>

			<Separator className="my-8" />

			<section className="mb-10">
				<h2 className="mb-1 text-base font-semibold">Password</h2>
				<p className="mb-4 text-sm text-muted-foreground">
					{dbUser.passwordHash
						? "Update your password."
						: "Set a password to enable email + password sign-in."}
				</p>
				<ChangePasswordForm hasPassword={!!dbUser.passwordHash} />
			</section>

			<Separator className="my-8" />

			<section className="mb-10">
				<h2 className="mb-1 text-base font-semibold">Linked accounts</h2>
				<p className="mb-4 text-sm text-muted-foreground">
					Sign-in methods connected to your account.
				</p>
				<LinkedProviders providers={providers} hasPassword={!!dbUser.passwordHash} />
			</section>

			<Separator className="my-8" />

			<section>
				<h2 className="mb-1 text-base font-semibold text-destructive">Danger zone</h2>
				<p className="mb-4 text-sm text-muted-foreground">
					Irreversible actions. Proceed with caution.
				</p>
				<DangerZone />
			</section>
		</main>
	);
}
