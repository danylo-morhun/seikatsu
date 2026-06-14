"use client";

import { Spinner } from "@/components/Spinner";
import { type TsundokuBook, updateBook } from "@/features/tsundoku/actions/books";
import { GENRE_OPTIONS } from "@/features/tsundoku/lib/constants";
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
import { useState } from "react";
import { toast } from "sonner";

export function EditBookModal({
	book,
	trigger,
}: {
	book: TsundokuBook;
	trigger: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const router = useRouter();

	const [form, setForm] = useState({
		title: book.title,
		authors: (book.authors ?? []).join(", "),
		isbn: book.isbn ?? "",
		coverUrl: book.coverUrl ?? "",
		pageCount: book.pageCount?.toString() ?? "",
		publishedYear: book.publishedYear?.toString() ?? "",
		genre: book.genre ?? "",
		seriesName: book.seriesName ?? "",
		seriesPosition: book.seriesPosition?.toString() ?? "",
		review: book.review ?? "",
	});

	function set<K extends keyof typeof form>(key: K, value: string) {
		setForm((f) => ({ ...f, [key]: value }));
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.title.trim()) {
			toast.error("Title is required");
			return;
		}
		setSaving(true);
		const res = await updateBook(book.id, {
			title: form.title.trim(),
			authors: form.authors
				.split(",")
				.map((a) => a.trim())
				.filter(Boolean),
			isbn: form.isbn || undefined,
			coverUrl: form.coverUrl || undefined,
			pageCount: form.pageCount ? Number.parseInt(form.pageCount, 10) : null,
			publishedYear: form.publishedYear ? Number.parseInt(form.publishedYear, 10) : null,
			genre: form.genre || undefined,
			seriesName: form.seriesName || undefined,
			seriesPosition: form.seriesPosition ? Number.parseInt(form.seriesPosition, 10) : null,
			rating: book.rating,
			review: form.review || undefined,
		});
		setSaving(false);
		if ("error" in res) {
			toast.error(res.error);
			return;
		}
		toast.success("Saved.");
		setOpen(false);
		router.refresh();
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Edit book</DialogTitle>
				</DialogHeader>
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="space-y-1.5">
						<Label>Title</Label>
						<Input value={form.title} onChange={(e) => set("title", e.target.value)} />
					</div>
					<div className="space-y-1.5">
						<Label>Author(s)</Label>
						<Input
							value={form.authors}
							onChange={(e) => set("authors", e.target.value)}
							placeholder="Comma-separated"
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Pages</Label>
							<Input
								type="number"
								value={form.pageCount}
								onChange={(e) => set("pageCount", e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Year</Label>
							<Input
								type="number"
								value={form.publishedYear}
								onChange={(e) => set("publishedYear", e.target.value)}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Genre</Label>
							<Select value={form.genre} onValueChange={(v) => set("genre", v)}>
								<SelectTrigger>
									<SelectValue placeholder="Select" />
								</SelectTrigger>
								<SelectContent>
									{GENRE_OPTIONS.map((g) => (
										<SelectItem key={g} value={g}>
											{g}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label>ISBN</Label>
							<Input value={form.isbn} onChange={(e) => set("isbn", e.target.value)} />
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Series</Label>
							<Input
								value={form.seriesName}
								onChange={(e) => set("seriesName", e.target.value)}
								placeholder="Series name"
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Series #</Label>
							<Input
								type="number"
								value={form.seriesPosition}
								onChange={(e) => set("seriesPosition", e.target.value)}
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label>Cover URL</Label>
						<Input value={form.coverUrl} onChange={(e) => set("coverUrl", e.target.value)} />
					</div>
					<div className="space-y-1.5">
						<Label>Review</Label>
						<textarea
							value={form.review}
							onChange={(e) => set("review", e.target.value)}
							rows={4}
							className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							placeholder="Your thoughts…"
						/>
					</div>
					<div className="flex justify-end gap-2 pt-1">
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
