import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/day/lib/data", () => ({ readPlan: vi.fn() }));
vi.mock("@/features/home/lib/agenda", () => ({ readAgenda: vi.fn() }));
vi.mock("@/features/pwa/lib/push", () => ({ sendOnce: vi.fn() }));

import { morningBrief } from "./notify";
import { buildQueue, type QueueData } from "./queue";

const TODAY = "2026-11-03";
const empty: QueueData = { money: null, wants: null, cards: null, jobs: null, car: null };
const card = {
	id: "a",
	title: "Card a",
	dueDate: TODAY,
	dueTime: null,
	projectId: "p",
	projectName: "Home",
	columnId: "col-todo",
	position: "a0",
	doneColumnId: "col-done",
};

describe("morningBrief", () => {
	const events = buildQueue(
		{
			...empty,
			events: [
				{ key: "event:a", source: "/calendar", title: "Gym", note: "" },
				{ key: "event:b", source: "/calendar", title: "Dentist", time: "10:00", note: "" },
			],
		},
		TODAY,
	);

	it("names the events apart from what waits", () => {
		const brief = morningBrief([...buildQueue({ ...empty, cards: [card] }, TODAY), ...events]);
		expect(brief).toEqual({
			title: "1 thing waiting today",
			body: "Card a\n2 events, first 10:00 Dentist",
		});
	});

	it("still pushes a day with only events", () => {
		expect(morningBrief(events)?.title).toBe("Today on the calendar");
	});
});
