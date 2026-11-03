import { PageTab, PageTabs } from "@/components/PageTabs";

/** The home's two views: the day to work through, and the week around it. */
export function DayTabs({ current }: { current: "today" | "week" }) {
	return (
		<PageTabs label="Today or week">
			<PageTab href="/" current={current === "today"}>
				Today
			</PageTab>
			<PageTab href="/week" current={current === "week"}>
				Week
			</PageTab>
		</PageTabs>
	);
}
