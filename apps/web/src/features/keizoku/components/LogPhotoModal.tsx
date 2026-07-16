"use client";

import { Spinner } from "@/components/Spinner";
import type { KeizokuHabit } from "@/features/keizoku/actions/habits";
import type { KeizokuHabitLog } from "@/features/keizoku/actions/logs";
import { logHabit } from "@/features/keizoku/actions/logs";
import { Cancel01Icon, ImageUpload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Label, cn } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
	habit: KeizokuHabit;
	date: string;
	log: KeizokuHabitLog | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onChange?: () => void;
}

export function LogPhotoModal({ habit, date, log, open, onOpenChange, onChange }: Props) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [note, setNote] = useState(log?.note ?? "");
	const [file, setFile] = useState<File | null>(null);
	const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!open) return;
		setNote(log?.note ?? "");
		setFile(null);
		setFileObjectUrl(null);
	}, [open, log]);

	const previewUrl = fileObjectUrl ?? log?.photoUrl ?? null;

	function handleFileSelect(f: File) {
		if (!f.type.startsWith("image/")) {
			toast.error("Only image files are allowed.");
			return;
		}
		if (f.size > 5 * 1024 * 1024) {
			toast.error("Image must be under 5 MB.");
			return;
		}
		if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl);
		setFileObjectUrl(URL.createObjectURL(f));
		setFile(f);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		const formData = new FormData();
		formData.set("habitId", habit.id);
		formData.set("date", date);
		formData.set("note", note);
		if (file) formData.set("photoFile", file);

		const res = await logHabit(formData);
		setSaving(false);
		if ("error" in res) {
			toast.error(res.error);
			return;
		}
		toast.success("Saved.");
		onOpenChange(false);
		if (onChange) onChange();
		else router.refresh();
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>
						{habit.emoji} {habit.name}
					</DialogTitle>
				</DialogHeader>
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="space-y-1.5">
						<Label>Photo</Label>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/jpeg,image/png,image/gif,image/webp"
							className="sr-only"
							onChange={(e: ChangeEvent<HTMLInputElement>) => {
								const f = e.target.files?.[0];
								if (f) handleFileSelect(f);
							}}
							tabIndex={-1}
						/>
						{previewUrl ? (
							<div className="relative">
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									className="block w-full"
									aria-label="Replace photo"
								>
									<img src={previewUrl} alt="" className="h-40 w-full rounded-lg object-cover" />
								</button>
								<button
									type="button"
									onClick={() => {
										if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl);
										setFile(null);
										setFileObjectUrl(null);
									}}
									className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
									aria-label="Remove photo"
								>
									<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								onDragOver={(e: DragEvent) => {
									e.preventDefault();
									setIsDragging(true);
								}}
								onDragLeave={(e: DragEvent) => {
									e.preventDefault();
									setIsDragging(false);
								}}
								onDrop={(e: DragEvent) => {
									e.preventDefault();
									setIsDragging(false);
									const f = e.dataTransfer.files[0];
									if (f) handleFileSelect(f);
								}}
								className={cn(
									"flex w-full cursor-pointer select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-all",
									isDragging
										? "border-primary bg-primary/5"
										: "border-border hover:border-muted-foreground/40 hover:bg-muted/20",
								)}
							>
								<HugeiconsIcon icon={ImageUpload01Icon} className="h-5 w-5 text-muted-foreground" />
								<p className="text-xs text-muted-foreground">Drop image or click to browse</p>
							</button>
						)}
					</div>
					<div className="space-y-1.5">
						<Label>Note</Label>
						<textarea
							value={note}
							onChange={(e) => setNote(e.target.value)}
							rows={3}
							className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							placeholder="Anything to remember…"
						/>
					</div>
					<div className="flex justify-end gap-2 pt-1">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={saving} className="gap-1.5">
							{saving && <Spinner />}
							{saving ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
