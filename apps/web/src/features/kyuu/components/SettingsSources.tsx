"use client";

import { SettingsSection } from "@/components/SettingsSection";
import { Spinner } from "@/components/Spinner";
import { FOOTER } from "@/features/keizoku/components/HabitDialog";
import { useHeld } from "@/hooks/useHeld";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
} from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { renameSource } from "../actions/applications";

const rise = (i: number) => ({ "--i": Math.min(i, 8) }) as CSSProperties;

/** Settings: every source with its count; rename one, or merge two spellings into one. */
export function SettingsSources({ sources }: { sources: { source: string; count: number }[] }) {
	const id = useId();
	const [renaming, setRenaming] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSaving] = useTransition();

	// The name stays in the title and the field while the dialog fades out.
	const shownSource = useHeld(renaming, renaming != null);

	useEffect(() => {
		if (renaming == null) return;
		setName(renaming);
		setError(null);
	}, [renaming]);

	const merging = name.trim() !== renaming && sources.some((s) => s.source === name.trim());

	return (
		<SettingsSection
			title="Sources"
			description="Where applications came from. Rename one to fix a spelling, or to merge it into another."
			meta={sources.length}
		>
			{sources.length === 0 ? (
				<p className="py-4 text-sm text-muted-foreground">
					No sources yet. They come from each application's Source field.
				</p>
			) : (
				<ul className="inset-group rounded-2xl bg-surface px-4 py-2 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent">
					{sources.map((s, i) => (
						<li
							key={s.source}
							className="flex animate-rise items-center gap-3 py-1.5"
							style={rise(i)}
						>
							<Link
								href={`/kyuu/all?source=${encodeURIComponent(s.source)}`}
								prefetch={false}
								className="min-w-0 flex-1 truncate rounded-sm text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								{s.source}
							</Link>
							<span className="font-figures text-xs text-muted-foreground">{s.count}</span>
							<Button
								variant="ghost"
								size="sm"
								className="text-muted-foreground hover:text-foreground"
								aria-label={`Rename ${s.source}`}
								onClick={() => setRenaming(s.source)}
							>
								Rename…
							</Button>
						</li>
					))}
				</ul>
			)}

			<Dialog open={renaming != null} onOpenChange={(v) => !v && !isSaving && setRenaming(null)}>
				<DialogContent className="max-sm:flex max-sm:flex-col sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Rename “{shownSource}”</DialogTitle>
						<DialogDescription>
							Every application from it moves to the new name. Name another source to merge the two.
						</DialogDescription>
					</DialogHeader>
					<form
						className="flex flex-1 flex-col gap-4"
						onSubmit={(e) => {
							e.preventDefault();
							if (!renaming) return;
							startSaving(async () => {
								const result = await renameSource(renaming, name).catch(() => ({
									error: "Couldn't save. Check your connection.",
								}));
								if ("error" in result) {
									setError(result.error);
									return;
								}
								toast(`${result.data.count} moved to “${name.trim()}”`);
								setRenaming(null);
							});
						}}
					>
						<div className="space-y-2">
							<Label htmlFor={`${id}-name`}>Name</Label>
							<Input
								id={`${id}-name`}
								list={`${id}-sources`}
								autoComplete="off"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
							<datalist id={`${id}-sources`}>
								{sources
									.filter((s) => s.source !== renaming)
									.map((s) => (
										<option key={s.source} value={s.source} />
									))}
							</datalist>
							{merging && (
								<p className="text-xs text-muted-foreground">
									Merges into the existing “{name.trim()}”.
								</p>
							)}
						</div>
						{error && (
							<p role="alert" className="text-[0.8rem] text-destructive">
								{error}
							</p>
						)}
						<div className={FOOTER}>
							<Button
								type="button"
								variant="outline"
								className="max-sm:flex-1"
								disabled={isSaving}
								onClick={() => setRenaming(null)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								className="gap-1.5 max-sm:flex-1"
								disabled={isSaving || !name.trim() || name.trim() === renaming}
							>
								{isSaving && <Spinner />}
								{isSaving ? "Saving…" : merging ? "Merge" : "Rename"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</SettingsSection>
	);
}
