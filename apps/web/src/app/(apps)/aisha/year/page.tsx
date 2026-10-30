import { PageTitle } from "@/components/PageTitle";
import { YearSwitch } from "@/components/YearSwitch";
import { getCar, getCurrentVehicle } from "@/features/aisha/actions/data";
import { MonthRows, YearFigures, YearServices } from "@/features/aisha/components/YearSections";
import { CURRENCY } from "@/features/aisha/lib/constants";
import { carYear, carYears } from "@/features/aisha/lib/year";
import { getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export default async function AishaYearPage({
	searchParams,
}: {
	searchParams: Promise<{ year?: string }>;
}) {
	const vehicle = await getCurrentVehicle();
	if (!vehicle) redirect("/aisha");

	const [{ year: rawYear }, today] = await Promise.all([searchParams, getUserToday()]);
	const car = await getCar(vehicle, today);
	const thisYear = Number(today.slice(0, 4));
	const years = carYears(
		[...car.readings.map((r) => r.date), ...car.services.map((s) => s.date)],
		thisYear,
	);
	const asked = Number(rawYear);
	const year = years.includes(asked) ? asked : thisYear;
	const stats = carYear(car.readings, car.services, year);
	const lastMonth = year === thisYear ? Number(today.slice(5, 7)) - 1 : 11;
	const currency = car.services[0]?.currency ?? CURRENCY;

	return (
		<div className="space-y-10 px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<PageTitle title={`${year}`} subtitle={`${vehicle.make} ${vehicle.model}`} />
			<div className="space-y-6">
				{years.length > 1 && <YearSwitch years={years} year={year} base="/aisha/year" />}
				<YearFigures year={stats} currency={currency} />
			</div>

			<div
				className="grid animate-rise gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12"
				style={rise(4)}
			>
				<section aria-labelledby="year-months">
					<h2 id="year-months" className="mb-3 text-sm font-medium">
						By month
					</h2>
					<MonthRows year={stats} lastMonth={lastMonth} currency={currency} />
				</section>
				<section aria-labelledby="year-services">
					<h2 id="year-services" className="mb-3 text-sm font-medium">
						Services
					</h2>
					<YearServices services={car.services.filter((s) => s.date.startsWith(String(year)))} />
				</section>
			</div>
		</div>
	);
}
