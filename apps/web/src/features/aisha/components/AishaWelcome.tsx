import { VehicleForm } from "@/features/aisha/components/VehicleForm";
import type { CSSProperties } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

/** First run: no car yet. The car's details make its maintenance plan. */
export function AishaWelcome({ workspaceId }: { workspaceId: string }) {
	return (
		<section aria-labelledby="aisha-welcome" className="max-w-xl py-4 md:py-6">
			<h1 id="aisha-welcome" className="animate-rise text-2xl font-semibold md:text-3xl">
				Look after the car.
			</h1>
			<p className="animate-rise mt-3 max-w-prose text-muted-foreground" style={rise(1)}>
				Aisha keeps the maintenance plan, the mileage and the paperwork, and says what's due next —
				by km or by date, whichever comes first. Every interval can be changed later.
			</p>
			<div className="animate-rise mt-8" style={rise(2)}>
				<VehicleForm workspaceId={workspaceId} />
			</div>
		</section>
	);
}
