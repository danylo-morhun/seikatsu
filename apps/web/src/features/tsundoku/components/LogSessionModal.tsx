"use client";

import { Spinner } from "@/components/Spinner";
import { logSession } from "@/features/tsundoku/actions/sessions";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Label,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function LogSessionModal({
	bookId,
	trigger,
}: {
	bookId: string;
	trigger: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
	const [pages, setPages] = useState("");
	const router = useRouter();

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		const pagesRead = Number.parseInt(pages, 10);
		if (!Number.isInteger(pagesRead) || pagesRead <= 0) {
			toast.error("Enter pages read");
			return;
		}
		setSaving(true);
		const res = await logSession(bookId, { date, pagesRead });
		setSaving(false);
		if ("error" in res) {
			toast.error(res.error);
			return;
		}
		toast.success("Session logged.");
		setPages("");
		setOpen(false);
		router.refresh();
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Log reading session</DialogTitle>
				</DialogHeader>
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="space-y-1.5">
						<Label>Date</Label>
						<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
					</div>
					<div className="space-y-1.5">
						<Label>Pages read</Label>
						<Input
							type="number"
							value={pages}
							onChange={(e) => setPages(e.target.value)}
							placeholder="e.g. 42"
							autoFocus
						/>
					</div>
					<div className="flex justify-end gap-2 pt-1">
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={saving} className="gap-1.5">
							{saving && <Spinner />}
							{saving ? "Saving…" : "Log"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
