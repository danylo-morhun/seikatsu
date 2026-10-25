"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import { ReadingDialog } from "@/features/aisha/components/ReadingDialog";
import { type KurojiDefaults, ServiceDialog } from "@/features/aisha/components/ServiceDialog";
import { LOG_SERVICE_EVENT, MILEAGE_EVENT, requestLogService } from "@/features/aisha/lib/events";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Calendar03Icon,
	Car01Icon,
	Settings01Icon,
	Time04Icon,
	Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
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

	const litColumn = pathname.startsWith("/settings/aisha")
		? 4
		: pathname === "/aisha/year"
			? 3
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

	const item = (href: string, label: string, icon: typeof Car01Icon, column: number) => {
		const active = litColumn === column;
		return (
			<Link
				href={href}
				prefetch
				aria-current={active ? "page" : undefined}
				className={cn(
					"group relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
					active ? "text-primary" : "text-muted-foreground active:text-foreground",
				)}
			>
				<span className="flex h-7 w-12 items-center justify-center">
					<HugeiconsIcon icon={icon} className="h-5 w-5" />
				</span>
				<span className="max-w-full truncate px-0.5 text-[11px] font-medium leading-none">
					{label}
				</span>
			</Link>
		);
	};

	return (
		<>
			<nav
				aria-label="Aisha sections"
				className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				<div className="relative mx-3 mb-3 grid grid-cols-5 items-center rounded-2xl border border-rule bg-sidebar px-1 py-1.5">
					{/* One pill slides to the lit item, so the move reads as going somewhere. */}
					<span
						aria-hidden
						className="pointer-events-none absolute top-1.5 left-1 flex w-[calc((100%-0.5rem)/5)] justify-center transition-transform duration-300 ease-in-out motion-reduce:transition-none"
						style={{ transform: `translateX(${litColumn * 100}%)` }}
					>
						<span className="h-7 w-12 rounded-full bg-primary/15" />
					</span>
					{item("/aisha", "Next", Car01Icon, 0)}
					{item("/aisha/history", "History", Time04Icon, 1)}
					<div className="relative flex items-center justify-center">
						<Button
							size="icon"
							aria-label="Log service"
							className="h-11 w-11 rounded-full"
							disabled={!car}
							onClick={() => requestLogService()}
						>
							<HugeiconsIcon icon={Wrench01Icon} className="h-5 w-5" />
						</Button>
					</div>
					{item("/aisha/year", "Year", Calendar03Icon, 3)}
					{item("/settings/aisha", "Settings", Settings01Icon, 4)}
				</div>
			</nav>

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
