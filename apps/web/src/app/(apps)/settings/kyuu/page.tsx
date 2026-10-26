import { getSources } from "@/features/kyuu/actions/applications";
import { countMissingCountries } from "@/features/kyuu/actions/countries";
import { SettingsCountries } from "@/features/kyuu/components/SettingsCountries";
import { SettingsSources } from "@/features/kyuu/components/SettingsSources";
import { getCurrentWorkspace } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function KyuuSettingsPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const [sources, missingCountries] = await Promise.all([getSources(), countMissingCountries()]);

	return (
		<div className="max-w-3xl px-4 pt-6 pb-28 sm:px-8 md:pt-8 md:pb-8">
			<h1 className="mb-8 text-xl font-semibold">求 Kyuu</h1>
			<SettingsSources sources={sources} />
			<SettingsCountries missing={missingCountries} />
			<p className="mt-10 text-sm text-muted-foreground">
				Archived applications live under{" "}
				<Link
					href="/kyuu/all?view=archived"
					prefetch
					className="text-foreground underline-offset-2 hover:underline"
				>
					All · Archived
				</Link>
				, where they can be restored or deleted.
			</p>
		</div>
	);
}
