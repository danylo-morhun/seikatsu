import { auth } from "@/auth";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { getApplications, getResumeFiles, getSources } from "@/features/kyuu/actions/applications";
import { AddApplicationModal } from "@/features/kyuu/components/AddApplicationModal";
import { ApplicationsTable } from "@/features/kyuu/components/ApplicationsTable";
import { hasActiveKyuuFilters, parseKyuuFilters } from "@/features/kyuu/lib/search-params";
import { redirect } from "next/navigation";

const SORT_FIELDS = ["date", "company", "status"] as const;
type SortField = (typeof SORT_FIELDS)[number];

export default async function KyuuPage({
	searchParams,
}: {
	searchParams: Promise<{
		status?: string;
		source?: string;
		stage?: string;
		from?: string;
		to?: string;
		q?: string;
		sort?: string;
		dir?: string;
	}>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));

	const raw = await searchParams;
	const filters = parseKyuuFilters(raw);
	const hasFilters = hasActiveKyuuFilters(filters);
	const sort: SortField = SORT_FIELDS.includes(raw.sort as SortField)
		? (raw.sort as SortField)
		: "date";
	const dir = raw.dir === "asc" ? "asc" : "desc";

	const [applications, sources, resumeFiles] = await Promise.all([
		getApplications(workspace.id, { ...filters, sort, dir }),
		getSources(workspace.id),
		getResumeFiles(workspace.id),
	]);

	return (
		<main className="flex flex-col pb-28 md:pb-0">
			<div className="px-4 py-6 md:px-8">
				<div className="mb-5 flex items-center justify-between">
					<div>
						<h1 className="text-lg font-semibold">Applications</h1>
						<p className="text-sm text-muted-foreground">
							{applications.length} application{applications.length !== 1 ? "s" : ""}
							{hasFilters ? " matching filters" : ""}
						</p>
					</div>
					<AddApplicationModal
						workspaceId={workspace.id}
						sources={sources}
						resumeFiles={resumeFiles}
					/>
				</div>
				<ApplicationsTable
					applications={applications}
					sources={sources}
					resumeFiles={resumeFiles}
					hasFilters={hasFilters}
					sortField={sort}
					sortDir={dir}
				/>
			</div>
		</main>
	);
}
