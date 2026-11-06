import { describe, expect, it } from "vitest";
import { parseDue } from "./parse-due";

// Friday.
const TODAY = "2026-11-06";
const p = (text: string) => parseDue(text, TODAY);

describe("parseDue", () => {
	it("reads near days in three languages", () => {
		expect(p("Call the garage tomorrow")).toEqual({
			title: "Call the garage",
			dueDate: "2026-11-07",
			dueTime: null,
		});
		expect(p("Позвонить в СТО завтра")?.dueDate).toBe("2026-11-07");
		expect(p("Подзвонити сьогодні")?.dueDate).toBe(TODAY);
		expect(p("Оплатить счёт послезавтра")).toEqual({
			title: "Оплатить счёт",
			dueDate: "2026-11-08",
			dueTime: null,
		});
	});

	it("reads weekdays as the next one to come", () => {
		expect(p("Pay rent by monday")).toEqual({
			title: "Pay rent",
			dueDate: "2026-11-09",
			dueTime: null,
		});
		expect(p("Send report fri")?.dueDate).toBe("2026-11-13");
		expect(p("Сдать отчёт до пятницы")).toEqual({
			title: "Сдать отчёт",
			dueDate: "2026-11-13",
			dueTime: null,
		});
		expect(p("Забрати посилку у вівторок")?.dueDate).toBe("2026-11-10");
		expect(p("Купить подарок в субботу")?.dueDate).toBe("2026-11-07");
	});

	it("reads times, with or without a day", () => {
		expect(p("Call the garage tomorrow 15:00")).toEqual({
			title: "Call the garage",
			dueDate: "2026-11-07",
			dueTime: "15:00",
		});
		expect(p("Dentist at 9:30")).toEqual({ title: "Dentist", dueDate: TODAY, dueTime: "09:30" });
		expect(p("Позвонить маме завтра в 18")?.dueTime).toBe("18:00");
		expect(p("Standup 10am")?.dueTime).toBe("10:00");
		expect(p("Dinner 7:30pm")?.dueTime).toBe("19:30");
		expect(p("Зустріч о 14")?.dueTime).toBe("14:00");
		expect(p("Позвонить маме в 18")).toEqual({
			title: "Позвонить маме",
			dueDate: TODAY,
			dueTime: "18:00",
		});
		expect(p("Gym sat 10:00")).toEqual({ title: "Gym", dueDate: "2026-11-07", dueTime: "10:00" });
		expect(p("Gym sun")?.dueDate).toBe("2026-11-08");
	});

	it("reads dates with month names and full dates", () => {
		expect(p("Renew passport 12 dec")?.dueDate).toBe("2026-12-12");
		expect(p("Renew passport on Jan 5")?.dueDate).toBe("2027-01-05");
		expect(p("Продлить страховку 3 марта")?.dueDate).toBe("2027-03-03");
		expect(p("Податок 20 листопада")?.dueDate).toBe("2026-11-20");
		expect(p("Visa 15.01.2027")?.dueDate).toBe("2027-01-15");
		expect(p("Visa 2027-01-15")?.dueDate).toBe("2027-01-15");
	});

	it("reads spans from today", () => {
		expect(p("Check tyres in 3 days")?.dueDate).toBe("2026-11-09");
		expect(p("Check tyres in a week")?.dueDate).toBe("2026-11-13");
		expect(p("Проверить через 2 недели")?.dueDate).toBe("2026-11-20");
		expect(p("Plan trip next week")?.dueDate).toBe("2026-11-09");
	});

	it("leaves plain titles and numbers alone", () => {
		expect(p("Buy 2.5 kg of rice")).toBeNull();
		expect(p("Upload P24 documents")).toBeNull();
		expect(p("Read chapter 12")).toBeNull();
		expect(p("Version 1.10 notes")).toBeNull();
		expect(p("Мама")).toBeNull();
		expect(p("Martin's notes")).toBeNull();
		expect(p("Buy sun cream")).toBeNull();
		expect(p("Fix sat nav")).toBeNull();
		expect(p("Купить в 2 магазинах")).toBeNull();
		// Nothing left for a title: keep the text as it is.
		expect(p("tomorrow")).toBeNull();
	});
});
