"use client";

import { Spinner } from "@/components/Spinner";
import { Button } from "@seikatsu/ui";
import { useId, useTransition } from "react";
import { toast } from "sonner";
import { fillMissingCountries } from "../actions/countries";

/** Settings: how many applications have no country yet, and a way to work them out. */
export function SettingsCountries({ missing }: { missing: number }) {
	const id = useId();
	const [isFilling, startFilling] = useTransition();

	return (
		<section aria-labelledby={`${id}-title`} className="mt-10">
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h2 id={`${id}-title`} className="text-sm font-medium">
					Countries
				</h2>
				<span className="font-figures text-xs text-muted-foreground">{missing} unknown</span>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3 border-y border-rule py-3">
				<p className="max-w-md text-sm text-muted-foreground">
					Gemini reads the posting of the 90 latest applications without a country and fills in
					where the job is. Mail sync does the same for new rows.
				</p>
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
			</div>
		</section>
	);
}
