"use client";

import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import { Thumb } from "@/features/hoshii/components/Thumb";
import { formatMoney } from "@/features/hoshii/lib/format";
import type { LinkValues } from "@/features/hoshii/lib/hoshii-schemas";
import { shopOf } from "@/features/hoshii/lib/product";
import { Camera01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Input, cn } from "@seikatsu/ui";
import { useRef, useState } from "react";

export type Reading = "idle" | "reading" | "found" | "failed";
/** A link in the form: what its page said so far, and whether it's still being read. */
export type LinkDraft = LinkValues & { key: string; reading: Reading };

export const isLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

/** What a link shows: its page's name, else the shop; then shop and price, or the reading. */
function LinkLine({ link }: { link: LinkDraft }) {
	const shop = shopOf(link.url) ?? link.url;
	return (
		<span className="min-w-0">
			<span className="block truncate text-sm">{link.title ?? shop}</span>
			<span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
				{link.reading === "reading" ? (
					<>
						<Spinner />
						Reading {shop}…
					</>
				) : link.reading === "failed" ? (
					`Couldn't read ${shop}`
				) : (
					<>
						{link.title ? shop : null}
						{link.title && link.price != null && " · "}
						{link.price != null && (
							<span className="font-figures">
								{link.currency ? formatMoney(link.price, link.currency) : link.price}
							</span>
						)}
					</>
				)}
			</span>
		</span>
	);
}

/** The links a want can be bought at, each removable, and a field to paste one more. */
export function LinkList({
	links,
	label,
	addLabel,
	full,
	onAdd,
	onRemove,
}: {
	links: LinkDraft[];
	label: string;
	addLabel: string;
	full: boolean;
	onAdd: (url: string) => void;
	onRemove: (key: string) => void;
}) {
	const [adding, setAdding] = useState<string | null>(null);
	const [invalid, setInvalid] = useState(false);

	function commit(text: string) {
		if (!text.trim()) {
			setAdding(null);
			return;
		}
		if (!isLink(text)) {
			setInvalid(true);
			return;
		}
		onAdd(text.trim());
		setAdding("");
	}

	return (
		<div className="space-y-2">
			{links.length > 0 && <p className="text-sm font-medium leading-none">{label}</p>}
			{links.length > 0 && (
				<ul className="space-y-1.5">
					{links.map((link) => (
						<li
							key={link.key}
							className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-surface py-1.5 pr-1.5 pl-1.5 animate-rise"
						>
							<Thumb src={link.imageUrl} className="size-10 rounded-md" />
							<LinkLine link={link} />
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={`Remove ${shopOf(link.url) ?? "link"}`}
								className="size-8 text-muted-foreground"
								onClick={() => onRemove(link.key)}
							>
								<HugeiconsIcon icon={Cancel01Icon} className="size-4" />
							</Button>
						</li>
					))}
				</ul>
			)}
			{full ? null : adding == null ? (
				<QuietAdd onClick={() => setAdding("")}>{addLabel}</QuietAdd>
			) : (
				<Input
					autoFocus
					type="url"
					autoComplete="off"
					aria-label={addLabel}
					aria-invalid={invalid || undefined}
					placeholder="Paste a shop link"
					value={adding}
					onChange={(e) => {
						setInvalid(false);
						// A pasted link goes in at once; the field stays for one more.
						if (isLink(e.target.value)) {
							onAdd(e.target.value.trim());
							setAdding("");
						} else setAdding(e.target.value);
					}}
					onBlur={() => !adding?.trim() && setAdding(null)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							commit(adding ?? "");
						} else if (e.key === "Escape") {
							e.stopPropagation();
							setAdding(null);
						}
					}}
				/>
			)}
		</div>
	);
}

/** The want's photo: one of its links' photos, or one from the device. Tap again for none. */
export function PhotoPicker({
	value,
	choices,
	uploading,
	onChange,
	onUpload,
}: {
	value: string | null;
	choices: string[];
	uploading: boolean;
	onChange: (url: string | null) => void;
	onUpload: (file: File) => void;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	return (
		<fieldset className="space-y-2">
			<legend className="mb-2 text-sm font-medium leading-none">Photo</legend>
			<div className="flex flex-wrap gap-2">
				{choices.map((url) => {
					const on = url === value;
					return (
						<button
							key={url}
							type="button"
							aria-pressed={on}
							aria-label={on ? "The photo. Tap for no photo" : "Use this photo"}
							onClick={() => onChange(on ? null : url)}
							className={cn(
								"rounded-[10px] outline-none transition-shadow duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring",
								on
									? "ring-2 ring-primary ring-offset-2 ring-offset-background"
									: "opacity-80 hover:opacity-100",
							)}
						>
							<Thumb src={url} className="size-14" />
						</button>
					);
				})}
				<button
					type="button"
					disabled={uploading}
					onClick={() => fileRef.current?.click()}
					className="grid size-14 place-items-center rounded-[10px] bg-surface text-muted-foreground outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
					aria-label="Upload a photo"
				>
					{uploading ? <Spinner /> : <HugeiconsIcon icon={Camera01Icon} className="size-5" />}
				</button>
				<input
					ref={fileRef}
					type="file"
					accept="image/*"
					className="sr-only"
					tabIndex={-1}
					aria-hidden
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) onUpload(file);
						e.target.value = "";
					}}
				/>
			</div>
		</fieldset>
	);
}
