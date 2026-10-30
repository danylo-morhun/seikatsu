import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { DESIGN_COOKIE, parseDesign } from "@/lib/design";
import { cookies } from "next/headers";

/** The signed-in shell: sidebar, header and the workspace, for every app and the home. */
export async function AppFrame({ children }: { children: React.ReactNode }) {
	const [cookieStore, session] = await Promise.all([cookies(), auth()]);

	const sidebarCookie = cookieStore.get("sidebar_state");
	const defaultOpen = sidebarCookie ? sidebarCookie.value === "true" : true;
	const design = parseDesign(cookieStore.get(DESIGN_COOKIE)?.value);

	const workspace = session?.user?.id ? await initializeWorkspace(session.user.id) : null;

	return (
		<AppShell
			workspaceName={workspace?.name ?? "My Workspace"}
			hiddenApps={workspace?.hiddenApps ?? []}
			workspaceId={workspace?.id}
			baseCurrency={workspace?.baseCurrency}
			sidebarDefaultOpen={defaultOpen}
			design={design}
			user={session?.user ?? null}
		>
			{children}
		</AppShell>
	);
}
