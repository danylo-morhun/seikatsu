import { auth } from "@/auth";
import { SettingsPage, SettingsSection } from "@/components/SettingsSection";
import { ChangeEmailForm } from "@/features/auth/components/ChangeEmailForm";
import { ChangePasswordForm } from "@/features/auth/components/ChangePasswordForm";
import { DangerZone } from "@/features/auth/components/DangerZone";
import { LinkedProviders } from "@/features/auth/components/LinkedProviders";
import { ProfileForm } from "@/features/auth/components/ProfileForm";
import { authAccounts, authUsers, db, eq } from "@seikatsu/db";
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
	const hasPassword = !!dbUser.passwordHash;

	return (
		<SettingsPage title="Account">
			<SettingsSection
				title="Profile"
				description="Your name and photo, as the sidebar shows them."
			>
				<ProfileForm name={dbUser.name} image={dbUser.image} />
			</SettingsSection>

			<SettingsSection
				title="Email"
				description={
					<>
						Signed in as <span className="text-foreground">{dbUser.email}</span>. A new address
						takes over once you open the link sent to it.
					</>
				}
			>
				<ChangeEmailForm pendingEmail={dbUser.pendingEmail ?? null} />
			</SettingsSection>

			<SettingsSection
				title="Password"
				description={
					hasPassword
						? "Used to sign in with your email."
						: "Set one to sign in with your email as well."
				}
			>
				<ChangePasswordForm hasPassword={hasPassword} />
			</SettingsSection>

			<SettingsSection title="Sign-in methods" description="Keep at least one; the last can't go.">
				<LinkedProviders providers={providers} hasPassword={hasPassword} />
			</SettingsSection>

			<SettingsSection title="Sessions and data">
				<DangerZone />
			</SettingsSection>
		</SettingsPage>
	);
}
