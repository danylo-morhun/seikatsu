"use client";

import {
	DAY_LABELS,
	FREQUENCY_LABELS,
	FREQUENCY_TYPES,
	type FrequencyType,
} from "@/features/keizoku/lib/constants";
import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	cn,
} from "@seikatsu/ui";

interface Props {
	frequencyType: FrequencyType;
	frequencyDays: number[];
	frequencyTarget: string;
	onFrequencyTypeChange: (v: FrequencyType) => void;
	onFrequencyDaysChange: (days: number[]) => void;
	onFrequencyTargetChange: (v: string) => void;
}

export function FrequencyPicker({
	frequencyType,
	frequencyDays,
	frequencyTarget,
	onFrequencyTypeChange,
	onFrequencyDaysChange,
	onFrequencyTargetChange,
}: Props) {
	return (
		<div className="space-y-3">
			<div className="space-y-1.5">
				<Label>Frequency</Label>
				<Select
					value={frequencyType}
					onValueChange={(v) => onFrequencyTypeChange(v as FrequencyType)}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{FREQUENCY_TYPES.map((f) => (
							<SelectItem key={f} value={f}>
								{FREQUENCY_LABELS[f]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{frequencyType === "weekdays" && (
				<div className="space-y-1.5">
					<Label>Days</Label>
					<div className="flex gap-1.5">
						{DAY_LABELS.map((label, i) => {
							const active = frequencyDays.includes(i);
							return (
								<button
									key={label}
									type="button"
									onClick={() =>
										onFrequencyDaysChange(
											active
												? frequencyDays.filter((d) => d !== i)
												: [...frequencyDays, i].sort((a, b) => a - b),
										)
									}
									className={cn(
										"flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
										active
											? "bg-primary text-primary-foreground"
											: "bg-muted text-muted-foreground hover:bg-muted/70",
									)}
								>
									{label[0]}
								</button>
							);
						})}
					</div>
				</div>
			)}

			{frequencyType === "times_per_week" && (
				<div className="space-y-1.5">
					<Label>Times per week</Label>
					<Input
						type="number"
						min={1}
						max={7}
						value={frequencyTarget}
						onChange={(e) => onFrequencyTargetChange(e.target.value)}
					/>
				</div>
			)}
		</div>
	);
}
