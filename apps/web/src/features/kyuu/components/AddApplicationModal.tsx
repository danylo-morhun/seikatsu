"use client";

import { Spinner } from "@/components/Spinner";
import { useRefreshRouter } from "@/hooks/useRefreshRouter";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Button,
	Checkbox,
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
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ResumeFile } from "../actions/applications";
import { createApplication } from "../actions/applications";
import { extractApplicationFromText } from "../actions/extract";
import {
	type ApplicationFormValues,
	applicationSchema,
	kyuuStatusValues,
} from "../lib/kyuu-schemas";
import { ResumeUploadField } from "./ResumeUploadField";
import { STATUS_CONFIG } from "./StatusBadge";

function today() {
	return new Date().toISOString().slice(0, 10);
}

const MIN_PASTE_LENGTH = 200;

export function AddApplicationModal({
	workspaceId,
	sources,
	resumeFiles,
}: { workspaceId: string; sources: string[]; resumeFiles: ResumeFile[] }) {
	const [open, setOpen] = React.useState(false);
	const [pasteMode, setPasteMode] = React.useState(false);
	const [pasteText, setPasteText] = React.useState("");
	const [isExtracting, startExtracting] = React.useTransition();
	const refresh = useRefreshRouter();

	const {
		register,
		handleSubmit,
		control,
		reset,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<ApplicationFormValues>({
		resolver: zodResolver(applicationSchema),
		defaultValues: {
			company: "",
			role: "",
			jobUrl: "",
			source: "",
			resumeFileUrl: "",
			resumeFileName: "",
			status: "applied",
			hrScreening: false,
			technicalInterview: false,
			offer: false,
			dateApplied: today(),
			notes: "",
		},
	});

	const onOpenChange = (val: boolean) => {
		setOpen(val);
		if (!val) {
			reset();
			setPasteMode(false);
			setPasteText("");
		}
	};

	const runExtract = React.useCallback(
		(text: string) => {
			startExtracting(async () => {
				const result = await extractApplicationFromText(text);
				if ("error" in result) {
					toast.error(result.error);
					return;
				}
				setValue("company", result.data.company, { shouldValidate: true });
				setValue("role", result.data.role, { shouldValidate: true });
				if (result.data.jobUrl) setValue("jobUrl", result.data.jobUrl, { shouldValidate: true });
				if (result.data.source) setValue("source", result.data.source);
				if (result.data.notes) setValue("notes", result.data.notes);
				setPasteMode(false);
				toast.success("Filled from posting — review before saving");
			});
		},
		[setValue],
	);

	const handleExtract = () => runExtract(pasteText);

	// Document-level listener so Cmd+V works no matter what's focused in the dialog —
	// relying on a form-level onPaste only catches it when a field already has focus.
	React.useEffect(() => {
		if (!open || pasteMode) return;
		const handler = (e: ClipboardEvent) => {
			if (isExtracting) return;
			const text = e.clipboardData?.getData("text") ?? "";
			if (text.trim().length < MIN_PASTE_LENGTH) return;
			e.preventDefault();
			runExtract(text);
		};
		document.addEventListener("paste", handler);
		return () => document.removeEventListener("paste", handler);
	}, [open, pasteMode, isExtracting, runExtract]);

	const onSubmit = async (values: ApplicationFormValues) => {
		const result = await createApplication(workspaceId, values);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		toast.success(`"${values.company}" added`);
		refresh();
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button size="sm">Add Application</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md max-w-full overflow-x-hidden">
				<DialogHeader>
					<DialogTitle>New Application</DialogTitle>
				</DialogHeader>

				{pasteMode ? (
					<div className="space-y-3 min-w-0">
						<div className="space-y-2">
							<Label htmlFor="app-paste">Paste job posting</Label>
							<textarea
								id="app-paste"
								rows={8}
								placeholder="Paste the job posting text here…"
								className="border-input dark:bg-input/30 flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
								value={pasteText}
								onChange={(e) => setPasteText(e.target.value)}
							/>
						</div>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => setPasteMode(false)}>
								Cancel
							</Button>
							<Button
								type="button"
								disabled={isExtracting || !pasteText.trim()}
								className="gap-1.5"
								onClick={handleExtract}
							>
								{isExtracting && <Spinner />}
								{isExtracting ? "Extracting…" : "Extract"}
							</Button>
						</div>
					</div>
				) : (
					<>
						{isExtracting ? (
							<div className="mb-1 flex w-fit items-center gap-2 text-sm text-muted-foreground">
								<Spinner />
								Extracting from pasted text…
							</div>
						) : (
							<div className="mb-1 flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-fit"
									onClick={() => setPasteMode(true)}
								>
									Paste job posting to autofill
								</Button>
								<span className="text-xs text-muted-foreground">or just press ⌘V</span>
							</div>
						)}
						<form
							onSubmit={handleSubmit(onSubmit, () =>
								toast.error("Please check the form for errors"),
							)}
							className="space-y-4 min-w-0"
						>
							<fieldset disabled={isSubmitting || isExtracting} className="contents min-w-0">
								<div className="space-y-2">
									<Label htmlFor="app-company">Company</Label>
									<Input
										id="app-company"
										placeholder="e.g. TENTENS Tech"
										{...register("company")}
									/>
									{errors.company && (
										<p className="text-destructive text-[0.8rem]">{errors.company.message}</p>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="app-role">Role</Label>
									<Input
										id="app-role"
										placeholder="e.g. Senior Frontend Engineer"
										{...register("role")}
									/>
									{errors.role && (
										<p className="text-destructive text-[0.8rem]">{errors.role.message}</p>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="app-url">Job Link (optional)</Label>
									<Input id="app-url" placeholder="https://…" {...register("jobUrl")} />
									{errors.jobUrl && (
										<p className="text-destructive text-[0.8rem]">{errors.jobUrl.message}</p>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="app-source">Source (optional)</Label>
									<Input
										id="app-source"
										placeholder="e.g. Djinni"
										list="kyuu-sources"
										{...register("source")}
									/>
									<datalist id="kyuu-sources">
										{sources.map((s) => (
											<option key={s} value={s} />
										))}
									</datalist>
								</div>

								<ResumeUploadField
									fileUrl={watch("resumeFileUrl") ?? ""}
									fileName={watch("resumeFileName") ?? ""}
									resumeFiles={resumeFiles}
									onChange={(fileUrl, fileNameVal) => {
										setValue("resumeFileUrl", fileUrl, { shouldValidate: true });
										setValue("resumeFileName", fileNameVal);
									}}
								/>

								<div className="space-y-2">
									<Label>Status</Label>
									<Controller
										control={control}
										name="status"
										render={({ field }) => (
											<Select onValueChange={field.onChange} value={field.value}>
												<SelectTrigger>
													<SelectValue placeholder="Select status" />
												</SelectTrigger>
												<SelectContent>
													{kyuuStatusValues.map((s) => (
														<SelectItem key={s} value={s}>
															{STATUS_CONFIG[s].label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="app-date">Date Applied</Label>
									<Input id="app-date" type="date" {...register("dateApplied")} />
									{errors.dateApplied && (
										<p className="text-destructive text-[0.8rem]">{errors.dateApplied.message}</p>
									)}
								</div>

								<div className="flex flex-wrap gap-4">
									<Controller
										control={control}
										name="hrScreening"
										render={({ field }) => (
											<label htmlFor="app-hr" className="flex items-center gap-2 text-sm">
												<Checkbox
													id="app-hr"
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
												HR Screening
											</label>
										)}
									/>
									<Controller
										control={control}
										name="technicalInterview"
										render={({ field }) => (
											<label htmlFor="app-tech" className="flex items-center gap-2 text-sm">
												<Checkbox
													id="app-tech"
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
												Technical Interview
											</label>
										)}
									/>
									<Controller
										control={control}
										name="offer"
										render={({ field }) => (
											<label htmlFor="app-offer" className="flex items-center gap-2 text-sm">
												<Checkbox
													id="app-offer"
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
												Offer
											</label>
										)}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="app-notes">Notes (optional)</Label>
									<textarea
										id="app-notes"
										rows={3}
										className="border-input dark:bg-input/30 flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
										{...register("notes")}
									/>
								</div>

								<div className="flex justify-end gap-2 pt-2">
									<Button type="button" variant="outline" onClick={() => setOpen(false)}>
										Cancel
									</Button>
									<Button type="submit" disabled={isSubmitting} className="gap-1.5">
										{isSubmitting && <Spinner />}
										{isSubmitting ? "Adding…" : "Add"}
									</Button>
								</div>
							</fieldset>
						</form>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
