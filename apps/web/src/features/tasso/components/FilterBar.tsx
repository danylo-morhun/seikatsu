"use client";

import { PRIORITY_CONFIG } from "@/features/tasso/lib/constants";
import { cn } from "@ethos/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type LabelData = { id: string; name: string; color: string };

const DUE_OPTIONS = [
	{ value: "overdue", label: "Overdue" },
	{ value: "today", label: "Today" },
	{ value: "week", label: "This week" },
	{ value: "none", label: "No date" },
] as const;

interface Props {
	projectLabels: LabelData[];
}

export function FilterBar({ projectLabels }: Props) {
	const router = useRouter();
	const params = useSearchParams();
	const [, startTransition] = useTransition();

	const activePriorities = (params.get("priority") ?? "").split(",").filter(Boolean);
	const activeLabels = (params.get("label") ?? "").split(",").filter(Boolean);
	const activeDue = params.get("due") ?? "";
	const hasFilters = activePriorities.length > 0 || activeLabels.length > 0 || activeDue !== "";

	function setParam(key: string, value: string | null) {
		const next = new URLSearchParams(params.toString());
		if (value === null) next.delete(key);
		else next.set(key, value);
		startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
	}

	function toggleMulti(key: string, value: string) {
		const current = (params.get(key) ?? "").split(",").filter(Boolean);
		const updated = current.includes(value)
			? current.filter((v) => v !== value)
			: [...current, value];
		setParam(key, updated.length > 0 ? updated.join(",") : null);
	}

	function clearAll() {
		const next = new URLSearchParams(params.toString());
		next.delete("priority");
		next.delete("label");
		next.delete("due");
		startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
	}

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="mr-1 text-xs font-medium text-muted-foreground">Filter:</span>

			{/* Priority */}
			{Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => {
				const active = activePriorities.includes(key);
				return (
					<button
						key={key}
						type="button"
						onClick={() => toggleMulti("priority", key)}
						className={cn(
							"flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
							active
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
						)}
					>
						<span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cfg.color)} />
						{cfg.label}
					</button>
				);
			})}

			{/* Label filters */}
			{projectLabels.length > 0 && (
				<>
					<div className="mx-1 h-4 w-px shrink-0 bg-border" />
					{projectLabels.map((label) => {
						const active = activeLabels.includes(label.id);
						return (
							<button
								key={label.id}
								type="button"
								onClick={() => toggleMulti("label", label.id)}
								className={cn(
									"flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
									active
										? "border-transparent"
										: "border-transparent bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
								)}
								style={
									active
										? {
												backgroundColor: `${label.color}22`,
												color: label.color,
												borderColor: `${label.color}66`,
											}
										: undefined
								}
							>
								<span
									className="h-1.5 w-1.5 shrink-0 rounded-full"
									style={{ backgroundColor: label.color }}
								/>
								{label.name}
							</button>
						);
					})}
				</>
			)}

			{/* Due date */}
			<div className="mx-1 h-4 w-px shrink-0 bg-border" />
			{DUE_OPTIONS.map(({ value, label }) => (
				<button
					key={value}
					type="button"
					onClick={() => setParam("due", activeDue === value ? null : value)}
					className={cn(
						"rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
						activeDue === value
							? "bg-primary text-primary-foreground"
							: "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
					)}
				>
					{label}
				</button>
			))}

			{/* Clear */}
			{hasFilters && (
				<>
					<div className="mx-1 h-4 w-px shrink-0 bg-border" />
					<button
						type="button"
						onClick={clearAll}
						className="rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
					>
						Clear
					</button>
				</>
			)}
		</div>
	);
}
