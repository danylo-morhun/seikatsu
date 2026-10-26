"use client";

import { SettingsSection } from "@/components/SettingsSection";
import { Spinner } from "@/components/Spinner";
import { Button } from "@seikatsu/ui";
import { useTransition } from "react";
import { toast } from "sonner";
import { fillMissingCountries } from "../actions/countries";

/** Settings: how many applications have no country yet, and a way to work them out. */
export function SettingsCountries({ missing }: { missing: number }) {
	const [isFilling, startFilling] = useTransition();

	return (
		<SettingsSection
			title="Countries"
			description="Gemini reads the postings of the 90 latest applications without a country and fills in where the job is. Mail sync does the same for new ones."
			meta={missing === 0 ? "All known" : `${missing} unknown`}
		>
			<Button
				variant="outline"
				className="gap-1.5"
				disabled={isFilling || missing === 0}
				onClick={() =>
					startFilling(async () => {
						const result = await fillMissingCountries().catch(() => ({
							error: "Couldn't reach the server. Check your connection.",
						}));
						if ("error" in result) toast.error(result.error);
						else
							toast(
								`${result.data.filled} of ${result.data.checked} filled in${
									result.data.filled < result.data.checked ? " · the rest weren't clear" : ""
								}`,
							);
					})
				}
			>
				{isFilling && <Spinner />}
				{isFilling ? "Filling in…" : "Fill in countries"}
			</Button>
		</SettingsSection>
	);
}
