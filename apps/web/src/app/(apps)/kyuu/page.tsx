import { auth } from "@/auth";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { getApplications, getSources } from "@/features/kyuu/actions/applications";
import { AddApplicationModal } from "@/features/kyuu/components/AddApplicationModal";
import { ApplicationsTable } from "@/features/kyuu/components/ApplicationsTable";
import type { KyuuStatus } from "@/features/kyuu/lib/kyuu-schemas";
import { kyuuStatusValues } from "@/features/kyuu/lib/kyuu-schemas";
import { redirect } from "next/navigation";

export default async function KyuuPage({
	searchParams,
}: {
	searchParams: Promise<{ status?: string }>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));

	const { status: rawStatus } = await searchParams;
	const status = kyuuStatusValues.includes(rawStatus as KyuuStatus)
		? (rawStatus as KyuuStatus)
		: undefined;

	const [applications, sources] = await Promise.all([
		getApplications(workspace.id, { status }),
		getSources(workspace.id),
	]);

	return (
		<div className="px-4 py-6 md:px-8">
			<div className="mb-5 flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold">Applications</h1>
					<p className="text-sm text-muted-foreground">
						{applications.length} application{applications.length !== 1 ? "s" : ""}
						{status ? " matching filter" : ""}
					</p>
				</div>
				<AddApplicationModal workspaceId={workspace.id} sources={sources} />
			</div>
			<ApplicationsTable applications={applications} sources={sources} statusFilter={status} />
		</div>
	);
}
