"use client";

import { Spinner } from "@/components/Spinner";
import type { AishaDocument } from "@/features/aisha/actions/data";
import { createDocument, updateDocument } from "@/features/aisha/actions/documents";
import {
	FOOTER,
	FieldError,
	Segmented,
	instantClass,
} from "@/features/aisha/components/DialogParts";
import {
	DOCUMENT_NAMES,
	DOCUMENT_TYPES,
	DOCUMENT_TYPE_LABELS,
	type DocumentType,
} from "@/features/aisha/lib/constants";
import { addMonths } from "@/features/aisha/lib/due";
import { localToday } from "@/features/aisha/lib/today";
import { useHeld } from "@/hooks/useHeld";
import { useKeptDraft } from "@/hooks/useKeptDraft";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	cn,
} from "@seikatsu/ui";
import { useEffect, useId, useState, useTransition } from "react";

type Form = { type: DocumentType; name: string; expiresOn: string; note: string };

function formOf(doc: AishaDocument | null, renew: boolean): Form {
	if (!doc) {
		return {
			type: "insurance",
			name: DOCUMENT_NAMES.insurance,
			expiresOn: addMonths(localToday(), 12),
			note: "",
		};
	}
	return {
		type: doc.type,
		name: doc.name,
		// A renewal runs a year on from the old end.
		expiresOn: renew ? addMonths(doc.expiresOn, 12) : doc.expiresOn,
		note: doc.note ?? "",
	};
}

/** Date-bound paperwork: a new one, an edit, or a renewal (a year on, ready to adjust). */
export function DocumentDialog({
	open,
	onOpenChange,
	instant,
	vehicleId,
	doc: docProp = null,
	renew: renewProp = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	instant?: boolean;
	vehicleId: string;
	doc?: AishaDocument | null;
	renew?: boolean;
}) {
	const doc = useHeld(docProp, open);
	const renew = useHeld(renewProp, open);
	const id = useId();
	const [form, setForm] = useState(() => formOf(doc, renew));
	const [error, setError] = useState<{ field?: keyof Form; message: string } | null>(null);
	const [isSaving, startSave] = useTransition();
	const set = <K extends keyof Form>(key: K, value: Form[K]) => {
		setForm((f) => ({ ...f, [key]: value }));
		setError(null);
	};

	// A new one's draft survives Escape, a click outside or ×; Cancel and Save start blank.
	const draft = useKeptDraft();
	useEffect(() => {
		if (open && !draft.resume(!doc && !renew)) {
			setForm(formOf(doc, renew));
			setError(null);
		}
		// Each opening starts from the saved document; a re-render while open keeps the edits.
	}, [open]);

	function changeType(type: DocumentType) {
		// The name follows the type until it's been typed over.
		const named = Object.values(DOCUMENT_NAMES).includes(form.name) || !form.name.trim();
		setForm((f) => ({ ...f, type, name: named ? DOCUMENT_NAMES[type] : f.name }));
		setError(null);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.name.trim()) {
			setError({ field: "name", message: "Name the document" });
			document.getElementById(`${id}-name`)?.focus();
			return;
		}
		startSave(async () => {
			const result = await (doc
				? updateDocument(doc.id, form)
				: createDocument(vehicleId, form)
			).catch(() => ({ error: "Couldn't save. Check your connection." }));
			if ("error" in result) setError({ message: result.error });
			else onOpenChange(false);
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (isSaving) return;
				if (!v) draft.keep(!doc && !renew);
				onOpenChange(v);
			}}
		>
			<DialogContent
				className={cn("sm:max-w-md max-sm:flex max-sm:flex-col", instantClass(instant))}
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					if (renew) document.getElementById(`${id}-until`)?.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle>{renew ? "Renew" : doc ? "Edit Document" : "New Document"}</DialogTitle>
					<DialogDescription className={renew ? undefined : "sr-only"}>
						{renew
							? `${doc?.name}: the new end date, a year on unless you change it.`
							: "Paperwork that runs out: insurance, inspection, and the like."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					{!renew && (
						<>
							<div className="space-y-2">
								<Label id={`${id}-type`}>Type</Label>
								<Segmented
									labelledBy={`${id}-type`}
									options={DOCUMENT_TYPES.map((t) => ({
										value: t,
										label: DOCUMENT_TYPE_LABELS[t],
									}))}
									value={form.type}
									onChange={changeType}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`${id}-name`}>Name</Label>
								<Input
									id={`${id}-name`}
									maxLength={80}
									autoComplete="off"
									value={form.name}
									aria-invalid={error?.field === "name" || undefined}
									onChange={(e) => set("name", e.target.value)}
								/>
							</div>
						</>
					)}
					<div className="space-y-2">
						<Label htmlFor={`${id}-until`}>Valid until</Label>
						<Input
							id={`${id}-until`}
							type="date"
							required
							value={form.expiresOn}
							onChange={(e) => set("expiresOn", e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${id}-note`}>Note</Label>
						<Input
							id={`${id}-note`}
							autoComplete="off"
							placeholder="Policy number, insurer"
							value={form.note}
							onChange={(e) => set("note", e.target.value)}
						/>
					</div>
					{error && <FieldError>{error.message}</FieldError>}
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
							{isSaving ? "Saving…" : doc ? "Save" : "Add Document"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
