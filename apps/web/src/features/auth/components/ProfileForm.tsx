"use client";

import { Spinner } from "@/components/Spinner";
import { updateProfile } from "@/features/auth/actions/settings";
import type { SettingsState } from "@/features/auth/actions/settings";
import { Cancel01Icon, ImageUpload01Icon, Link01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, cn } from "@seikatsu/ui";
import { Button } from "@seikatsu/ui/button";
import { Input } from "@seikatsu/ui/input";
import { Label } from "@seikatsu/ui/label";
import { type ChangeEvent, type DragEvent, useRef, useState, useTransition } from "react";

type Tab = "file" | "url";

interface Props {
	name: string | null;
	image: string | null;
}

function isValidUrl(str: string) {
	try {
		new URL(str);
		return true;
	} catch {
		return false;
	}
}

export function ProfileForm({ name, image }: Props) {
	const [state, setState] = useState<SettingsState>(null);
	const [pending, startTransition] = useTransition();

	const [tab, setTab] = useState<Tab>("file");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null);
	const [urlInput, setUrlInput] = useState(image ?? "");
	const [isDragging, setIsDragging] = useState(false);
	const [clearedImage, setClearedImage] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);

	// Derived — no separate state needed
	const previewUrl =
		tab === "file"
			? (fileObjectUrl ?? (clearedImage ? null : image) ?? null)
			: isValidUrl(urlInput)
				? urlInput
				: (image ?? null);

	function handleFileSelect(file: File) {
		if (!file.type.startsWith("image/")) {
			setState({ error: "Only image files are allowed." });
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			setState({ error: "Image must be under 2 MB." });
			return;
		}
		if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl);
		setFileObjectUrl(URL.createObjectURL(file));
		setSelectedFile(file);
		setState(null);
	}

	function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (file) handleFileSelect(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		setIsDragging(true);
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		setIsDragging(false);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files[0];
		if (file) handleFileSelect(file);
	}

	function clearAll() {
		if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl);
		setFileObjectUrl(null);
		setSelectedFile(null);
		setUrlInput("");
		setClearedImage(true);
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setState(null);

		const formData = new FormData(e.currentTarget);

		if (tab === "file" && selectedFile) {
			formData.set("avatarFile", selectedFile);
		} else if (tab === "url") {
			formData.set("image", urlInput);
		} else {
			formData.set("image", clearedImage ? "" : (image ?? ""));
		}

		startTransition(async () => {
			const result = await updateProfile(null, formData);
			setState(result);
		});
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			{/* Avatar preview + name */}
			<div className="flex items-center gap-5">
				<div className="relative shrink-0">
					<Avatar src={previewUrl} name={name} size="lg" className="h-20 w-20 text-2xl" />
					{(fileObjectUrl ||
						(tab === "file" && !clearedImage && image) ||
						(tab === "url" && urlInput)) && (
						<button
							type="button"
							onClick={clearAll}
							className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition-opacity hover:opacity-80"
							aria-label="Clear avatar"
						>
							<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
						</button>
					)}
				</div>
				<div className="flex-1 space-y-1.5">
					<Label htmlFor="name">Display name</Label>
					<Input id="name" name="name" defaultValue={name ?? ""} required maxLength={100} />
				</div>
			</div>

			{/* Avatar source */}
			<div className="space-y-2">
				<Label>Avatar photo</Label>

				{/* Tab switcher */}
				<div className="flex w-fit rounded-md border border-border bg-muted/40 p-0.5 gap-0.5">
					<button
						type="button"
						onClick={() => setTab("file")}
						className={cn(
							"flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-all",
							tab === "file"
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<HugeiconsIcon icon={ImageUpload01Icon} className="h-3.5 w-3.5" />
						Upload file
					</button>
					<button
						type="button"
						onClick={() => setTab("url")}
						className={cn(
							"flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-all",
							tab === "url"
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<HugeiconsIcon icon={Link01Icon} className="h-3.5 w-3.5" />
						Use URL
					</button>
				</div>

				{/* Drop zone */}
				{tab === "file" && (
					<>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/jpeg,image/png,image/gif,image/webp"
							className="sr-only"
							onChange={handleFileChange}
							tabIndex={-1}
						/>
						<div
							role="button"
							tabIndex={0}
							onClick={() => fileInputRef.current?.click()}
							onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							className={cn(
								"flex cursor-pointer select-none flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-all",
								isDragging
									? "border-primary bg-primary/5"
									: selectedFile
										? "border-border bg-muted/20"
										: "border-border hover:border-muted-foreground/40 hover:bg-muted/20",
							)}
						>
							{selectedFile ? (
								<>
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/10">
										<HugeiconsIcon icon={ImageUpload01Icon} className="h-5 w-5 text-primary" />
									</div>
									<div>
										<p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
										<p className="text-xs text-muted-foreground">
											{(selectedFile.size / 1024).toFixed(0)} KB · click to replace
										</p>
									</div>
								</>
							) : (
								<>
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted ring-4 ring-muted/50">
										<HugeiconsIcon
											icon={ImageUpload01Icon}
											className={cn(
												"h-5 w-5 transition-colors",
												isDragging ? "text-primary" : "text-muted-foreground",
											)}
										/>
									</div>
									<div>
										<p className="text-sm font-medium">
											{isDragging ? "Drop it here" : "Drop image here"}
										</p>
										<p className="text-xs text-muted-foreground">or click to browse</p>
									</div>
									<p className="text-xs text-muted-foreground/70">JPG, PNG, WebP · max 2 MB</p>
								</>
							)}
						</div>
					</>
				)}

				{/* URL input */}
				{tab === "url" && (
					<Input
						type="url"
						value={urlInput}
						onChange={(e) => setUrlInput(e.target.value)}
						placeholder="https://example.com/avatar.jpg"
						autoFocus
					/>
				)}
			</div>

			{state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
			{state && "success" in state && <p className="text-sm text-green-500">Profile updated.</p>}

			<Button type="submit" disabled={pending} className="gap-1.5">
				{pending && <Spinner />}
				{pending ? "Saving…" : "Save changes"}
			</Button>
		</form>
	);
}
