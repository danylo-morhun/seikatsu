import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/calendar/lib/agenda", () => ({ readEventsAgenda: vi.fn() }));
vi.mock("@/features/pwa/lib/push", () => ({ sendOnce: vi.fn() }));

import type { EventToday } from "@/features/calendar/lib/agenda";
import { dueReminders } from "./notify";

const at = (h: number, m: number) => ({ day: "2026-11-27", minutes: h * 60 + m, weekday: 5 });
const ev = (key: string, time?: string): EventToday => ({
	key,
	source: "/calendar",
	title: key,
	note: "",
	time,
});

describe("dueReminders", () => {
	const events = [ev("allDay"), ev("ten", "10:00"), ev("noon", "12:00")];

	it("pushes a timed event in the 15 minutes before it starts", () => {
		expect(dueReminders(events, at(9, 45)).map((e) => e.key)).toEqual(["ten"]);
		expect(dueReminders(events, at(9, 59)).map((e) => e.key)).toEqual(["ten"]);
	});

	it("is quiet before that, once it started, and for all-day events", () => {
		expect(dueReminders(events, at(9, 44))).toEqual([]);
		expect(dueReminders(events, at(10, 0))).toEqual([]);
		expect(dueReminders([ev("allDay")], at(0, 0))).toEqual([]);
	});
});
