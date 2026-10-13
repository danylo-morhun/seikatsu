import { getShelvesWithCounts } from "@/features/tsundoku/actions/shelves";
import { SettingsShelves } from "@/features/tsundoku/components/SettingsShelves";
import { getCurrentWorkspace } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TsundokuSettingsPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const shelves = await getShelvesWithCounts();

	return (
		<div className="max-w-3xl px-4 pt-6 pb-28 sm:px-8 md:pt-8 md:pb-8">
			<h1 className="mb-8 text-xl font-semibold">積 Tsundoku</h1>
			<SettingsShelves shelves={shelves} />
			<p className="mt-10 text-sm text-muted-foreground">
				The yearly reading goal is set on the{" "}
				<Link
					href="/tsundoku/year"
					prefetch
					className="text-foreground underline-offset-2 hover:underline"
				>
					Year
				</Link>{" "}
				page.
			</p>
		</div>
	);
}
