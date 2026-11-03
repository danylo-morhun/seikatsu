import { PageTab, PageTabs } from "@/components/PageTabs";

/** The home's views: the day to work through, the week around it, and what it's all for. */
export function DayTabs({ current }: { current: "today" | "week" | "goals" }) {
	return (
		<PageTabs label="Today, week or goals">
			<PageTab href="/" current={current === "today"}>
				Today
			</PageTab>
			<PageTab href="/week" current={current === "week"}>
				Week
			</PageTab>
			<PageTab href="/goals" current={current === "goals"}>
				Goals
			</PageTab>
		</PageTabs>
	);
}
