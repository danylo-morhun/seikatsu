import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { cookies } from "next/headers";

export default async function AppsLayout({ children }: { children: React.ReactNode }) {
	const [cookieStore, session] = await Promise.all([cookies(), auth()]);

	const sidebarCookie = cookieStore.get("sidebar_state");
	const defaultOpen = sidebarCookie ? sidebarCookie.value === "true" : true;

	const workspace = session?.user?.id ? await initializeWorkspace(session.user.id) : null;

	return (
		<AppShell
			workspaceName={workspace?.name ?? "My Workspace"}
			workspaceId={workspace?.id}
			baseCurrency={workspace?.baseCurrency}
			sidebarDefaultOpen={defaultOpen}
			user={session?.user ?? null}
		>
			{children}
		</AppShell>
	);
}
