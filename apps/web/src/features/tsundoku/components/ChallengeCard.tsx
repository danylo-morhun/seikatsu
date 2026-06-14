"use client";

import { Spinner } from "@/components/Spinner";
import { setGoal } from "@/features/tsundoku/actions/goals";
import { Target02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Card, CardContent, Input } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function ChallengeCard({
	workspaceId,
	year,
	target,
	booksRead,
}: {
	workspaceId: string;
	year: number;
	target: number | null;
	booksRead: number;
}) {
	const router = useRouter();
	const [editing, setEditing] = useState(target == null);
	const [value, setValue] = useState(target?.toString() ?? "");
	const [saving, setSaving] = useState(false);

	async function onSave(e: React.FormEvent) {
		e.preventDefault();
		const targetBooks = Number.parseInt(value, 10);
		if (!Number.isInteger(targetBooks) || targetBooks < 1) {
			toast.error("Enter a target");
			return;
		}
		setSaving(true);
		const res = await setGoal(workspaceId, { year, targetBooks });
		setSaving(false);
		if ("error" in res) {
			toast.error(res.error);
			return;
		}
		setEditing(false);
		router.refresh();
	}

	const pct = target ? Math.min(100, Math.round((booksRead / target) * 100)) : 0;
	const R = 52;
	const C = 2 * Math.PI * R;
	const onPace = target ? booksRead >= (target * (new Date().getMonth() + 1)) / 12 : false;

	return (
		<Card>
			<CardContent className="flex flex-col items-center gap-4 py-6 text-center">
				<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
					<HugeiconsIcon icon={Target02Icon} className="h-4 w-4" />
					{year} Reading Challenge
				</div>

				{target != null && !editing ? (
					<>
						<div className="relative h-32 w-32">
							<svg
								viewBox="0 0 120 120"
								className="h-full w-full -rotate-90"
								role="img"
								aria-label={`${booksRead} of ${target} books read`}
							>
								<title>{`${booksRead} of ${target} books read`}</title>
								<circle
									cx="60"
									cy="60"
									r={R}
									fill="none"
									strokeWidth="10"
									className="stroke-muted"
								/>
								<circle
									cx="60"
									cy="60"
									r={R}
									fill="none"
									strokeWidth="10"
									strokeLinecap="round"
									className="stroke-primary transition-all"
									strokeDasharray={C}
									strokeDashoffset={C - (C * pct) / 100}
								/>
							</svg>
							<div className="absolute inset-0 flex flex-col items-center justify-center">
								<span className="text-2xl font-bold tabular-nums">{booksRead}</span>
								<span className="text-xs text-muted-foreground">of {target}</span>
							</div>
						</div>
						<p className="text-sm">
							{booksRead >= target ? (
								<span className="font-medium text-emerald-500">Goal reached! 🎉</span>
							) : onPace ? (
								<span className="text-emerald-500">On pace</span>
							) : (
								<span className="text-amber-500">Behind pace</span>
							)}
						</p>
						<Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
							Edit goal
						</Button>
					</>
				) : (
					<form onSubmit={onSave} className="flex w-full max-w-[220px] flex-col items-center gap-3">
						<p className="text-sm text-muted-foreground">How many books this year?</p>
						<Input
							type="number"
							value={value}
							onChange={(e) => setValue(e.target.value)}
							placeholder="e.g. 24"
							className="text-center"
							autoFocus
						/>
						<Button type="submit" disabled={saving} className="gap-1.5">
							{saving && <Spinner />}
							Set goal
						</Button>
					</form>
				)}
			</CardContent>
		</Card>
	);
}
