"use client";

import { AutoHeight } from "@/components/AutoHeight";
import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import { FOOTER, FieldError, instantClass } from "@/features/aisha/components/DialogParts";
import { parseNumber } from "@/features/aisha/lib/format";
import { localToday } from "@/features/aisha/lib/today";
import type { ChromeData, HoshiiItem } from "@/features/hoshii/actions/data";
import { updateItem } from "@/features/hoshii/actions/items";
import { readLink } from "@/features/hoshii/actions/link";
import { createList } from "@/features/hoshii/actions/lists";
import { CurrencySelect, Toggle } from "@/features/hoshii/components/Parts";
import { Thumb } from "@/features/hoshii/components/Thumb";
import { coolingDays } from "@/features/hoshii/lib/cooling";
import { addDays, formatDay } from "@/features/hoshii/lib/dates";
import type { ItemFormValues } from "@/features/hoshii/lib/hoshii-schemas";
import { QUEUED_TOAST, saveNewItem } from "@/features/hoshii/lib/offline";
import { shopOf } from "@/features/hoshii/lib/product";
import { NEEDS_CONNECTION } from "@/features/pwa/lib/run";
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
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

type Reading = "idle" | "reading" | "found" | "failed";

type Form = {
	/** Add only: a link or a name, whichever was typed or pasted. */
	query: string;
	title: string;
	url: string;
	imageUrl: string | null;
	price: string;
	currency: string;
	listId: string | null;
	note: string;
	skip: boolean;
};

const isLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

function formOf(item: HoshiiItem | null, chrome: ChromeData): Form {
	return {
		query: "",
		title: item?.title ?? "",
		url: item?.url ?? "",
		imageUrl: item?.imageUrl ?? null,
		price: item?.price != null ? String(Number(item.price)).replace(".", ",") : "",
		currency: item?.currency ?? chrome.currency,
		listId: item?.listId ?? null,
		note: item?.note ?? "",
		skip: false,
	};
}

/**
 * A want, new or edited. New: one field takes a shop link (name, photo and price are read
 * from the page) or just a name. It cools for a time set by its price, unless needed now.
 */
export function ItemDialog({
	open,
	onOpenChange,
	instant,
	chrome,
	item = null,
	initialUrl,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	instant?: boolean;
	chrome: ChromeData;
	/** null = add a new want. */
	item?: HoshiiItem | null;
	/** Shared from a shop app: read at once. */
	initialUrl?: string;
}) {
	const id = useId();
	const editing = item != null;
	const [form, setForm] = useState(() => formOf(item, chrome));
	const [reading, setReading] = useState<Reading>("idle");
	const [error, setError] = useState<{ field?: keyof Form; message: string } | null>(null);
	const [lists, setLists] = useState(chrome.lists);
	const [newList, setNewList] = useState<string | null>(null);
	const [isSaving, startSave] = useTransition();
	const readId = useRef(0);
	const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => setLists(chrome.lists), [chrome.lists]);

	useEffect(() => {
		if (!open) return;
		setForm(formOf(item, chrome));
		setReading("idle");
		setError(null);
		setNewList(null);
		if (initialUrl) {
			setForm((f) => ({ ...f, query: initialUrl, url: initialUrl }));
			read(initialUrl);
		}
		// Each opening starts from what was asked for, not from the last edit.
	}, [open]);

	const set = <K extends keyof Form>(key: K, value: Form[K]) => {
		setForm((f) => ({ ...f, [key]: value }));
		setError(null);
	};

	/** Reads the shop's page; fills only what the user hasn't typed. */
	function read(link: string) {
		const mine = ++readId.current;
		setReading("reading");
		readLink(link)
			.catch(() => ({ error: NEEDS_CONNECTION }))
			.then((result) => {
				if (mine !== readId.current) return;
				if ("error" in result) {
					setReading("failed");
					return;
				}
				const info = result.data;
				setReading("found");
				setForm((f) => ({
					...f,
					title: f.title || info.title || shopOf(link) || "",
					imageUrl: info.imageUrl ?? f.imageUrl,
					price: f.price || info.price == null ? f.price : String(info.price).replace(".", ","),
					currency: f.price || !info.currency ? f.currency : info.currency,
				}));
			});
	}

	function onQuery(text: string) {
		clearTimeout(debounce.current);
		const link = isLink(text);
		setForm((f) => ({
			...f,
			query: text,
			url: link ? text.trim() : "",
			// Typing a name: that's the name. A link: the page names it.
			title: link ? "" : text,
			imageUrl: link ? f.imageUrl : null,
		}));
		setError(null);
		if (link) debounce.current = setTimeout(() => read(text.trim()), 350);
		else {
			readId.current++;
			setReading("idle");
		}
	}

	function addList() {
		const name = newList?.trim();
		if (!name) {
			setNewList(null);
			return;
		}
		createList(name)
			.catch(() => ({ error: NEEDS_CONNECTION }))
			.then((result) => {
				if ("error" in result) {
					toast.error(result.error);
					return;
				}
				setLists((l) => [...l, result.data]);
				set("listId", result.data.id);
				setNewList(null);
			});
	}

	const price = parseNumber(form.price);
	const days =
		form.currency === chrome.currency || price == null ? coolingDays(price, chrome.tiers) : null;
	const shown = editing || form.query.trim() !== "";

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const title = form.title.trim();
		if (!title) {
			setError({ field: "title", message: "Name the want" });
			document.getElementById(`${id}-${editing || form.url ? "title" : "query"}`)?.focus();
			return;
		}
		if (form.price.trim() && (price == null || price < 0)) {
			setError({ field: "price", message: "Enter the price as a number" });
			return;
		}
		const url = form.url.trim();
		if (url && !isLink(url)) {
			setError({ field: "url", message: "Enter a web link, starting with https://" });
			return;
		}
		const values: ItemFormValues = {
			title,
			url: url || null,
			imageUrl: form.imageUrl,
			price,
			currency: form.currency,
			listId: form.listId,
			note: form.note,
			skipCooling: !editing && form.skip,
		};
		startSave(async () => {
			const result = await (item ? updateItem(item.id, values) : saveNewItem(values)).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) {
				setError({ message: result.error });
				return;
			}
			if ("queued" in result) toast(QUEUED_TOAST);
			else if (!item) {
				toast.success(
					form.skip
						? `${title} is in the Plan`
						: days != null
							? `${title} cools until ${formatDay(addDays(localToday(), days), localToday())}`
							: `${title} is cooling`,
				);
			}
			onOpenChange(false);
		});
	}

	const invalid = (field: keyof Form) => error?.field === field || undefined;

	return (
		<Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
			<DialogContent
				className={cn("sm:max-w-lg max-sm:flex max-sm:flex-col", instantClass(instant))}
			>
				<DialogHeader>
					<DialogTitle>{editing ? "Edit Want" : "Add a Want"}</DialogTitle>
					<DialogDescription className="sr-only">
						A shop link or a name, its price, and the list it goes in.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
					{!editing && (
						<div className="space-y-2">
							<Label htmlFor={`${id}-query`}>Link or name</Label>
							<Input
								id={`${id}-query`}
								autoComplete="off"
								placeholder="Paste a shop link, or type what you want"
								value={form.query}
								aria-invalid={invalid("title") && !form.url ? true : undefined}
								onChange={(e) => onQuery(e.target.value)}
							/>
							{reading === "reading" && (
								<p className="flex items-center gap-2 text-xs text-muted-foreground">
									<Spinner />
									Reading {shopOf(form.url) ?? "the page"}…
								</p>
							)}
							{reading === "failed" && (
								<p className="text-xs text-muted-foreground">
									Couldn't read {shopOf(form.url) ?? "the page"}. Fill in the name and price; the
									link stays.
								</p>
							)}
						</div>
					)}

					<AutoHeight>
						{shown && (
							<div className="animate-swap space-y-4">
								{(editing || form.url) && (
									<div
										className={cn(
											"grid gap-3",
											form.imageUrl && "grid-cols-[4rem_minmax(0,1fr)] items-start",
										)}
									>
										{form.imageUrl && <Thumb src={form.imageUrl} className="size-16" />}
										<div className="space-y-2">
											<Label htmlFor={`${id}-title`}>Name</Label>
											<Input
												id={`${id}-title`}
												autoComplete="off"
												placeholder={reading === "reading" ? "Reading…" : "What is it?"}
												value={form.title}
												aria-invalid={invalid("title")}
												onChange={(e) => set("title", e.target.value)}
											/>
										</div>
									</div>
								)}
								{editing && (
									<div className="space-y-2">
										<Label htmlFor={`${id}-url`}>Link</Label>
										<Input
											id={`${id}-url`}
											type="url"
											autoComplete="off"
											placeholder="Optional"
											value={form.url}
											aria-invalid={invalid("url")}
											onChange={(e) => set("url", e.target.value)}
										/>
									</div>
								)}

								<div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
									<div className="space-y-2">
										<Label htmlFor={`${id}-price`}>Price</Label>
										<Input
											id={`${id}-price`}
											inputMode="decimal"
											autoComplete="off"
											placeholder="Optional"
											className="font-figures"
											value={form.price}
											aria-invalid={invalid("price")}
											onChange={(e) => set("price", e.target.value)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`${id}-currency`}>Currency</Label>
										<CurrencySelect
											id={`${id}-currency`}
											value={form.currency}
											onChange={(v) => set("currency", v)}
										/>
									</div>
								</div>

								<fieldset className="space-y-2">
									<legend className="mb-2 text-sm font-medium leading-none">List</legend>
									<div className="flex flex-wrap items-center gap-1.5">
										{lists.map((list) => {
											const on = form.listId === list.id;
											return (
												<button
													key={list.id}
													type="button"
													aria-pressed={on}
													onClick={() => set("listId", on ? null : list.id)}
													className={cn(
														"h-9 rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring max-sm:h-10",
														on
															? "bg-primary text-primary-foreground"
															: "bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground",
													)}
												>
													{list.name}
												</button>
											);
										})}
										{newList == null ? (
											<QuietAdd className="px-1" onClick={() => setNewList("")}>
												New list
											</QuietAdd>
										) : (
											<Input
												autoFocus
												aria-label="New list"
												placeholder="Tech, Home…"
												className="h-9 w-36"
												value={newList}
												onChange={(e) => setNewList(e.target.value)}
												onBlur={addList}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														addList();
													} else if (e.key === "Escape") {
														e.stopPropagation();
														setNewList(null);
													}
												}}
											/>
										)}
									</div>
								</fieldset>

								<div className="space-y-2">
									<Label htmlFor={`${id}-note`}>Why you want it</Label>
									<Input
										id={`${id}-note`}
										autoComplete="off"
										placeholder="Optional. It helps when it's time to decide"
										value={form.note}
										onChange={(e) => set("note", e.target.value)}
									/>
								</div>

								{!editing && (
									<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-surface px-3.5 py-2.5 text-sm">
										<span className="min-w-0 text-muted-foreground">
											{form.skip ? (
												<>
													Goes straight to the <span className="text-foreground">Plan</span>
												</>
											) : days != null ? (
												<>
													Cools for <span className="text-foreground">{days} days</span>, until{" "}
													<span className="font-figures text-foreground">
														{formatDay(addDays(localToday(), days), localToday())}
													</span>
												</>
											) : (
												"Cools for a time set by its price"
											)}
										</span>
										<Toggle checked={form.skip} onChange={(v) => set("skip", v)}>
											Need it now
										</Toggle>
									</div>
								)}
							</div>
						)}
					</AutoHeight>

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
						<Button type="submit" className="gap-1.5 max-sm:flex-1" disabled={isSaving || !shown}>
							{isSaving && <Spinner />}
							{isSaving ? "Saving…" : editing ? "Save" : "Add Want"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
