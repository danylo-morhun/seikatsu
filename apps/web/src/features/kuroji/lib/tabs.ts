export type KurojiTab = "expense" | "accounts" | "transactions" | "plan";

export function buildTabHref(tab: KurojiTab, currentParams: string): string {
	const params = new URLSearchParams(currentParams);
	if (tab === "expense") {
		params.delete("tab");
	} else {
		params.set("tab", tab);
	}
	// The plan has its own month; the other tabs keep the period.
	if (tab !== "plan") params.delete("month");
	if (tab !== "transactions") {
		params.delete("page");
		params.delete("account");
		params.delete("q");
		params.delete("sort");
		params.delete("dir");
		params.delete("tag");
	}
	const qs = params.toString();
	return qs ? `/kuroji?${qs}` : "/kuroji";
}
