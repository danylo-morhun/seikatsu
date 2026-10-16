import { getApplication } from "@/features/kyuu/actions/applications";
import { ApplicationPage } from "@/features/kyuu/components/ApplicationPage";
import { EVENT_KINDS, type EventKind } from "@/features/kyuu/lib/stages";
import { getUserToday } from "@/lib/timezone";
import { notFound } from "next/navigation";

export default async function KyuuApplicationPage({
	params,
	searchParams,
}: {
	params: Promise<{ applicationId: string }>;
	searchParams: Promise<{ log?: string }>;
}) {
	const [{ applicationId }, { log }] = await Promise.all([params, searchParams]);
	const [result, today] = await Promise.all([getApplication(applicationId), getUserToday()]);
	if ("error" in result) notFound();
	// S and I on the table land here with the event to log open.
	const logKind = (EVENT_KINDS as readonly string[]).includes(log ?? "")
		? (log as EventKind)
		: null;

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<ApplicationPage application={result.data} today={today} logKind={logKind} />
		</div>
	);
}
