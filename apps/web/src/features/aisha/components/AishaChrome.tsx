"use client";

import { GlassTabBar } from "@/components/GlassTabBar";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { ReadingDialog } from "@/features/aisha/components/ReadingDialog";
import { type KurojiDefaults, ServiceDialog } from "@/features/aisha/components/ServiceDialog";
import { LOG_SERVICE_EVENT, MILEAGE_EVENT } from "@/features/aisha/lib/events";
import { pageKey } from "@/lib/capture-shortcut";
import { Calendar03Icon, Car01Icon, Settings01Icon, Time04Icon } from "@hugeicons/core-free-icons";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export interface ChromeData {
	vehicleId: string;
	workspaceId: string;
	currentKm: number;
	items: { id: string; name: string }[];
	kurojiDefaults: KurojiDefaults;
}

/**
 * Aisha's chrome around every page of the app: the phone's bottom pill (Next, History, log a
 * service, Year, Settings), the Log Service and Update Mileage dialogs it, the header and the
 * queue open, and the app-wide keys.
 */
export function AishaChrome({ car }: { car: ChromeData | null }) {
	const pathname = usePathname();
	const router = useRouter();
	const [service, setService] = useState<{
		open: boolean;
		instant: boolean;
		itemIds: string[];
	}>({ open: false, instant: false, itemIds: [] });
	const [mileage, setMileage] = useState({ open: false, instant: false });

	const lit = pathname.startsWith("/settings/aisha")
		? 3
		: pathname === "/aisha/year"
			? 2
			: pathname === "/aisha/history"
				? 1
				: 0;

	// N logs a service, M updates the mileage; 1–3 go to the pages, "," to settings.
	useEffect(() => {
		function go(href: string) {
			startNavigationProgress();
			router.push(href);
		}
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "n" && car) setService({ open: true, instant: true, itemIds: [] });
			else if (k === "m" && car) setMileage({ open: true, instant: true });
			else if (k === "1") go("/aisha");
			else if (k === "2") go("/aisha/history");
			else if (k === "3") go("/aisha/year");
			else if (k === ",") go("/settings/aisha");
			else return;
			e.preventDefault();
		}
		function onService(e: Event) {
			const itemIds = (e as CustomEvent<{ itemIds?: string[] }>).detail?.itemIds ?? [];
			setService({ open: true, instant: false, itemIds });
		}
		function onMileage() {
			setMileage({ open: true, instant: false });
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(LOG_SERVICE_EVENT, onService);
		window.addEventListener(MILEAGE_EVENT, onMileage);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(LOG_SERVICE_EVENT, onService);
			window.removeEventListener(MILEAGE_EVENT, onMileage);
		};
	}, [router, car]);

	return (
		<>
			<GlassTabBar
				label="Aisha sections"
				active={lit}
				items={[
					{ label: "Next", icon: Car01Icon, href: "/aisha" },
					{ label: "History", icon: Time04Icon, href: "/aisha/history" },
					{ label: "Year", icon: Calendar03Icon, href: "/aisha/year" },
					{ label: "Settings", icon: Settings01Icon, href: "/settings/aisha" },
				]}
			/>

			{car && (
				<>
					<ServiceDialog
						open={service.open}
						instant={service.instant}
						onOpenChange={(open) => setService((s) => ({ ...s, open }))}
						preselected={service.itemIds}
						vehicleId={car.vehicleId}
						workspaceId={car.workspaceId}
						currentKm={car.currentKm}
						items={car.items}
						kurojiDefaults={car.kurojiDefaults}
					/>
					<ReadingDialog
						open={mileage.open}
						instant={mileage.instant}
						onOpenChange={(open) => setMileage((m) => ({ ...m, open }))}
						vehicleId={car.vehicleId}
						currentKm={car.currentKm}
					/>
				</>
			)}
		</>
	);
}
