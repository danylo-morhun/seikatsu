"use client";

import { Spinner } from "@/components/Spinner";
import { updateProfile } from "@/features/auth/actions/settings";
import { Camera01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, cn } from "@seikatsu/ui";
import { Button } from "@seikatsu/ui/button";
import { Input } from "@seikatsu/ui/input";
import { Label } from "@seikatsu/ui/label";
import { type DragEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

const MAX_BYTES = 2 * 1024 * 1024;
const QUIET =
	"rounded-sm text-sm text-muted-foreground underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

/** The photo is a file, a link, or nothing; the saved one until it changes. */
type Photo = { kind: "saved" } | { kind: "file"; file: File; preview: string } | { kind: "url" };

function isUrl(str: string) {
	try {
		return Boolean(new URL(str));
	} catch {
		return false;
	}
}

interface Props {
	name: string | null;
	image: string | null;
}

/**
 * Name and photo. The avatar itself is the upload target (click or drop a file);
 * a link or removal sit beside it as quiet text. Save stays quiet until something changed.
 */
export function ProfileForm({ name: savedName, image }: Props) {
	const id = useId();
	const [name, setName] = useState(savedName ?? "");
	const [photo, setPhoto] = useState<Photo>({ kind: "saved" });
	const [url, setUrl] = useState(image ?? "");
	const [cleared, setCleared] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const fileRef = useRef<HTMLInputElement>(null);

	// The preview owns an object URL; let it go when replaced or unmounted.
	const preview = photo.kind === "file" ? photo.preview : null;
	useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

	const shown =
		photo.kind === "file"
			? photo.preview
			: photo.kind === "url"
				? isUrl(url)
					? url
					: null
				: cleared
					? null
					: image;

	const dirty =
		name.trim() !== (savedName ?? "") ||
		photo.kind === "file" ||
		(photo.kind === "url" && url.trim() !== (image ?? "")) ||
		(photo.kind === "saved" && cleared && image !== null);

	function pick(file: File) {
		if (!file.type.startsWith("image/")) return setError("That isn't an image.");
		if (file.size > MAX_BYTES) return setError("Pick an image under 2 MB.");
		setError(null);
		setCleared(false);
		setPhoto({ kind: "file", file, preview: URL.createObjectURL(file) });
	}

	function remove() {
		setPhoto({ kind: "saved" });
		setCleared(true);
		setUrl("");
		if (fileRef.current) fileRef.current.value = "";
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		setDragging(false);
		const file = e.dataTransfer.files[0];
		if (file) pick(file);
	}

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (photo.kind === "url" && url.trim() && !isUrl(url.trim())) {
			return setError("That link isn't a full address (https://…).");
		}
		const formData = new FormData();
		formData.set("name", name.trim());
		if (photo.kind === "file") formData.set("avatarFile", photo.file);
		else if (photo.kind === "url") formData.set("image", url.trim());
		else formData.set("image", cleared ? "" : (image ?? ""));

		setError(null);
		startTransition(async () => {
			const result = await updateProfile(null, formData).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if (result && "error" in result) return setError(result.error);
			setPhoto({ kind: "saved" });
			setCleared(false);
			toast.success("Profile saved");
		});
	}

	const hasPhoto = shown !== null;

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="flex items-center gap-5">
				<button
					type="button"
					onClick={() => fileRef.current?.click()}
					onDragOver={(e) => {
						e.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={onDrop}
					aria-label={hasPhoto ? "Change photo" : "Upload photo"}
					className={cn(
						"group relative size-20 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						dragging && "ring-2 ring-primary ring-offset-2 ring-offset-background",
					)}
				>
					<Avatar src={shown} name={name || savedName} className="size-20 text-2xl" />
					<span
						aria-hidden
						className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
					>
						<HugeiconsIcon icon={Camera01Icon} className="size-5" />
					</span>
				</button>
				<input
					ref={fileRef}
					type="file"
					accept="image/jpeg,image/png,image/gif,image/webp"
					className="sr-only"
					tabIndex={-1}
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) pick(file);
					}}
				/>
				<div className="min-w-0 flex-1 space-y-2">
					<Label htmlFor={`${id}-name`}>Name</Label>
					<Input
						id={`${id}-name`}
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						maxLength={100}
						autoComplete="name"
					/>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
				<button type="button" className={QUIET} onClick={() => fileRef.current?.click()}>
					{hasPhoto ? "Upload another" : "Upload a photo"}
				</button>
				<button
					type="button"
					className={cn(QUIET, photo.kind === "url" && "text-foreground")}
					onClick={() => {
						setError(null);
						setPhoto({ kind: "url" });
					}}
				>
					Use a link
				</button>
				{hasPhoto && (
					<button type="button" className={QUIET} onClick={remove}>
						Remove
					</button>
				)}
				<span className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 2 MB</span>
			</div>

			{photo.kind === "url" && (
				<div className="space-y-2">
					<Label htmlFor={`${id}-url`}>Photo link</Label>
					<Input
						id={`${id}-url`}
						type="url"
						inputMode="url"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://example.com/me.jpg"
						autoFocus
					/>
				</div>
			)}

			{error && (
				<p role="alert" className="text-[0.8rem] text-destructive">
					{error}
				</p>
			)}

			<Button
				type="submit"
				variant={dirty ? "default" : "outline"}
				disabled={pending || !dirty || !name.trim()}
				className="gap-1.5"
			>
				{pending && <Spinner />}
				{pending ? "Saving…" : "Save profile"}
			</Button>
		</form>
	);
}
