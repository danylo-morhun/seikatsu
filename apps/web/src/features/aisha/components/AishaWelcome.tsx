import { AppWelcome } from "@/components/AppWelcome";
import { VehicleForm } from "@/features/aisha/components/VehicleForm";

/** First run: no car yet. The car's details make its maintenance plan. */
export function AishaWelcome({ workspaceId }: { workspaceId: string }) {
	return (
		<AppWelcome
			app="/aisha"
			title="Look after the car."
			lead="Aisha keeps the maintenance plan, the mileage and the paperwork, and says what's due next — by km or by date, whichever comes first. Tell it about the car and the plan writes itself; every interval can be changed later."
		>
			<div className="max-w-xl pt-2">
				<VehicleForm workspaceId={workspaceId} />
			</div>
		</AppWelcome>
	);
}
