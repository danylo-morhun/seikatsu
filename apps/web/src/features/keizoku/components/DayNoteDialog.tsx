"use client";

import { Spinner } from "@/components/Spinner";
import { FOOTER } from "@/features/keizoku/components/HabitDialog";
import { Photo } from "@/features/keizoku/components/Photo";
import { Camera01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Label,
	cn,
} from "@seikatsu/ui";
import { useEffect, useId, useRef, useState, useTransition } from "react";

export const FIELD_TEXTAREA =
	"w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-colors [field-sizing:content] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

const PHOTO_MAX = 5 * 1024 * 1024;
const DAY = new Intl.DateTimeFormat("en", {
	weekday: "short",
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

export function formatDay(date: string) {
	return DAY.format(new Date(`${date}T00:00:00Z`));
}

export interface DayNoteTarget {
	habitId: string;
	habitName: string;
	emoji: string;
	date: string;
	note: string | null;
	photoUrl: string | null;
}

/**
 * A done day's note and photo. The photo is a choice, never a step: pick one, replace it, or
 * clear it; an unchanged photo stays as it is.
 */
export function DayNoteDialog({
	target,
	onOpenChange,
	onSave,
	instant = false,
}: {
	target: DayNoteTarget | null;
	onOpenChange: (open: boolean) => void;
	/** Resolves with an error message, or nothing when saved. */
	onSave: (formData: FormData) => Promise<string | undefined>;
	instant?: boolean;
}) {
	const id = useId();
	const open = target != null;
	const [note, setNote] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [removed, setRemoved] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!target) return;
		setNote(target.note ?? "");
		setFile(null);
		setRemoved(false);
		setError(null);
	}, [target]);

	// The picked file's preview lives as long as the pick.
	useEffect(() => {
		if (!file) return setPreview(null);
		const url = URL.createObjectURL(file);
		setPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	const shown = preview ?? (removed ? null : (target?.photoUrl ?? null));

	function pick(f: File | undefined) {
		if (!f) return;
		if (!f.type.startsWith("image/")) return setError("That isn't a photo.");
		if (f.size > PHOTO_MAX) return setError("The photo must be under 5 MB.");
		setError(null);
		setFile(f);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!target) return;
		const data = new FormData();
		data.set("habitId", target.habitId);
		data.set("date", target.date);
		data.set("note", note);
		if (file) data.set("photoFile", file);
		else if (removed) data.set("removePhoto", "1");
		startSave(async () => {
			const failed = await onSave(data);
			if (failed) setError(failed);
			else onOpenChange(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className={cn(
					"sm:max-w-md max-sm:flex max-sm:flex-col",
					instant && "data-[state=closed]:animate-none data-[state=open]:animate-none",
				)}
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="truncate">{target?.habitName}</DialogTitle>
					<DialogDescription>{target && formatDay(target.date)}</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-note`}>Note</Label>
						<textarea
							id={`${id}-note`}
							value={note}
							maxLength={2000}
							placeholder="How it went, what to remember"
							onChange={(e) => setNote(e.target.value)}
							className={cn(FIELD_TEXTAREA, "max-h-48 min-h-20")}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${id}-photo`}>Photo</Label>
						<input
							ref={fileRef}
							id={`${id}-photo`}
							type="file"
							accept="image/*"
							className="sr-only"
							onChange={(e) => {
								pick(e.target.files?.[0]);
								e.target.value = "";
							}}
						/>
						{shown ? (
							<div className="relative">
								<button
									type="button"
									onClick={() => fileRef.current?.click()}
									className="block w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
									aria-label="Replace the photo"
								>
									<Photo src={shown} className="aspect-[4/3] w-full rounded-md" />
								</button>
								<Button
									type="button"
									variant="secondary"
									size="icon"
									aria-label="Remove the photo"
									className="absolute top-2 right-2 size-8 rounded-full"
									onClick={() => {
										setFile(null);
										setRemoved(true);
									}}
								>
									<HugeiconsIcon icon={Cancel01Icon} className="size-4" />
								</Button>
							</div>
						) : (
							<Button
								type="button"
								variant="outline"
								className="w-full gap-2 text-muted-foreground"
								onClick={() => fileRef.current?.click()}
							>
								<HugeiconsIcon icon={Camera01Icon} className="size-4" />
								Add a photo
							</Button>
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
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" className="gap-1.5 max-sm:flex-1" disabled={isSaving}>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
