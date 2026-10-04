"use client";

import { Spinner } from "@/components/Spinner";
import type { AishaDocument } from "@/features/aisha/actions/data";
import { createDocument, deleteDocument, updateDocument } from "@/features/aisha/actions/documents";
import {
	DOCUMENT_TYPES,
	DOCUMENT_TYPE_LABELS,
	type DocumentType,
} from "@/features/aisha/lib/constants";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/** Create (no `doc`) or edit (with `doc`) a dated document like OC insurance or przegląd. */
export function DocumentModal({
	vehicleId,
	doc,
	trigger,
}: {
	vehicleId: string;
	doc?: AishaDocument;
	trigger: React.ReactNode;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	const [deleting, startDelete] = useTransition();
	const [type, setType] = useState<DocumentType>(doc?.type ?? "insurance");
	const [name, setName] = useState(doc?.name ?? "");
	const [expiresOn, setExpiresOn] = useState(doc?.expiresOn ?? "");
	const [note, setNote] = useState(doc?.note ?? "");

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		const values = { type, name, expiresOn, note };
		startTransition(async () => {
			const res = doc
				? await updateDocument(doc.id, values)
				: await createDocument(vehicleId, values);
			if ("error" in res) {
				toast.error(res.error);
				return;
			}
			toast.success(doc ? "Saved." : "Document added.");
			setOpen(false);
			if (!doc) {
				setName("");
				setExpiresOn("");
				setNote("");
			}
			router.refresh();
		});
	}

	function onDelete() {
		if (!doc || !confirm(`Delete "${doc.name}"?`)) return;
		startDelete(async () => {
			const res = await deleteDocument(doc.id);
			if ("error" in res) {
				toast.error(res.error);
				return;
			}
			toast.success("Deleted.");
			setOpen(false);
			router.refresh();
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{doc ? "Edit document" : "New document"}</DialogTitle>
				</DialogHeader>
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="space-y-1.5">
						<Label>Type</Label>
						<Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DOCUMENT_TYPES.map((t) => (
									<SelectItem key={t} value={t}>
										{DOCUMENT_TYPE_LABELS[t]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="d-name">Name</Label>
						<Input
							id="d-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={type === "inspection" ? "Przegląd techniczny" : "OC insurance"}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="d-exp">Valid until</Label>
						<Input
							id="d-exp"
							type="date"
							value={expiresOn}
							onChange={(e) => setExpiresOn(e.target.value)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="d-note">Note</Label>
						<Input
							id="d-note"
							value={note}
							onChange={(e) => setNote(e.target.value)}
							placeholder="Policy no., insurer…"
						/>
					</div>
					<div className="flex items-center justify-between gap-2 pt-1">
						{doc ? (
							<Button
								type="button"
								variant="ghost"
								className="gap-1.5 text-destructive"
								disabled={deleting}
								onClick={onDelete}
							>
								{deleting && <Spinner />}
								Delete
							</Button>
						) : (
							<span />
						)}
						<div className="flex gap-2">
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={pending} className="gap-1.5">
								{pending && <Spinner />}
								{pending ? "Saving…" : "Save"}
							</Button>
						</div>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
