"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@seikatsu/ui";

const STAGE_OPTIONS = [
	{ key: "hr", label: "HR Screening" },
	{ key: "tech", label: "Technical Interview" },
	{ key: "offer", label: "Offer" },
] as const;

export type StageKey = (typeof STAGE_OPTIONS)[number]["key"];

interface Props {
	value: StageKey[];
	onChange: (value: StageKey[]) => void;
}

export function StageFilter({ value, onChange }: Props) {
	function toggle(key: StageKey) {
		onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
	}

	const label =
		value.length === 0
			? "Reached stage"
			: value.length === 1
				? STAGE_OPTIONS.find((s) => s.key === value[0])?.label
				: `${value.length} stages`;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="h-8 gap-1.5 px-2.5 text-xs font-medium">
					{label}
					<HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5 opacity-60" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-48">
				{STAGE_OPTIONS.map((s) => (
					<DropdownMenuCheckboxItem
						key={s.key}
						checked={value.includes(s.key)}
						onSelect={(e) => e.preventDefault()}
						onCheckedChange={() => toggle(s.key)}
					>
						{s.label}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
