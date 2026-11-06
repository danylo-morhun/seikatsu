// How a planned action reads in the capture dialog: its app, a title, one line of detail. Pure.

import type { CaptureContext, PlannedAction } from "@/features/capture/lib/plan";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { PRIORITY_CONFIG } from "@/features/seiryu/lib/constants";
import type { APPS_CONFIG } from "@/lib/app-themes";

type Options = Pick<
	CaptureContext,
	"wallets" | "expenseCategories" | "incomeCategories" | "projects" | "lists"
>;

const KM = new Intl.NumberFormat("pl-PL");
const DAY = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });

const when = (date: string, today?: string) =>
	date === today ? "today" : DAY.format(new Date(`${date}T00:00:00Z`));

const line = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

export function describeAction(
	action: PlannedAction,
	options: Options,
	today?: string,
): { app: keyof typeof APPS_CONFIG; title: string; detail: string } {
	switch (action.kind) {
		case "expense":
		case "income": {
			const list = action.kind === "income" ? options.incomeCategories : options.expenseCategories;
			const category = list.find((c) => c.id === action.categoryId)?.name;
			return {
				app: "/kuroji",
				title: `${action.kind === "income" ? "Income" : "Expense"} ${formatCurrency(action.amount, action.currency)}`,
				detail: line(action.description, category ?? "pick a category", when(action.date, today)),
			};
		}
		case "mileage":
			return {
				app: "/aisha",
				title: `Mileage ${KM.format(action.km)} km`,
				detail: `${action.vehicleName} · +${KM.format(action.km - action.from)} km · ${when(action.date, today)}`,
			};
		case "want":
			return {
				app: "/hoshii",
				title: `Want: ${action.title}`,
				detail: line(
					action.price != null && formatCurrency(action.price, action.currency),
					options.lists.find((l) => l.id === action.listId)?.name,
					action.now ? "straight to the Plan" : "starts cooling",
				),
			};
		case "card":
			return {
				app: "/seiryu",
				title: `Card: ${action.title}`,
				detail: line(
					options.projects.find((p) => p.id === action.projectId)?.name ?? "pick a project",
					action.dueDate &&
						`due ${action.dueDate === today ? "today" : when(action.dueDate)}${action.dueTime ? ` ${action.dueTime}` : ""}`,
					action.priority && PRIORITY_CONFIG[action.priority].label,
				),
			};
		case "habit":
			return {
				app: "/keizoku",
				title: `${action.emoji} ${action.name}`.trim(),
				detail: `done ${when(action.date, today)}`,
			};
		case "pages":
			return {
				app: "/tsundoku",
				title: `${action.title}: page ${action.page}`,
				detail: `+${action.page - action.from} pages`,
			};
	}
}
