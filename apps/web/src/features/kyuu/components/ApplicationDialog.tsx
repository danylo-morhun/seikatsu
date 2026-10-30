"use client";

import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import { FOOTER } from "@/features/keizoku/components/HabitDialog";
import { useKeptDraft } from "@/hooks/useKeptDraft";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	cn,
} from "@seikatsu/ui";
import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { extractApplicationFromText } from "../actions/extract";
import { localToday } from "../lib/format";
import { type ApplicationFormValues, applicationSchema } from "../lib/kyuu-schemas";
import { STATUSES, STATUS_CONFIG } from "../lib/stages";
import type { ResumeFile } from "../lib/types";
import { ResumeUploadField } from "./ResumeUploadField";

export const FIELD_TEXTAREA =
	"w-full resize-none rounded-field border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-colors [field-sizing:content] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

/** A paste this long is a job posting, not a company name. */
const MIN_PASTE_LENGTH = 200;

function blank(): ApplicationFormValues {
	return {
		company: "",
		role: "",
		jobUrl: "",
		source: "",
		status: "applied",
		dateApplied: localToday(),
		contact: "",
		salary: "",
		location: "",
		notes: "",
		resumeFileUrl: "",
		resumeFileName: "",
	};
}

interface Props {
	open: boolean;
	/** Opened by a key: no zoom in or out. */
	instant?: boolean;
	onOpenChange: (open: boolean) => void;
	sources: string[];
	resumeFiles: ResumeFile[];
	/** Resolves to an error message, or nothing when saved. */
	onSave: (values: ApplicationFormValues) => Promise<string | undefined>;
}

/** New Application: the posting's facts. Pasting a whole posting fills them in. */
export function ApplicationDialog({
	open,
	instant = false,
	onOpenChange,
	sources,
	resumeFiles,
	onSave,
}: Props) {
	const id = useId();
	const [isExtracting, startExtracting] = useTransition();
	const [showMore, setShowMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
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
		defaultValues: blank(),
	});

	// Each opening starts blank, never from the last one's leftovers — unless the last one was
	// dismissed (Escape, a click outside, ×): then its draft comes back. Cancel and Save drop it.
	const draft = useKeptDraft();
	useEffect(() => {
		if (!open || draft.resume()) return;
		reset(blank());
		setShowMore(false);
		setError(null);
	}, [open, reset]);

	const extract = useCallback(
		(text: string) => {
			startExtracting(async () => {
				const result = await extractApplicationFromText(text).catch(() => ({
					error: "Extraction failed, try again",
				}));
				if ("error" in result) {
					toast.error(result.error);
					return;
				}
				const { company, role, jobUrl, source, notes } = result.data;
				setValue("company", company, { shouldValidate: true });
				setValue("role", role, { shouldValidate: true });
				if (jobUrl) setValue("jobUrl", jobUrl, { shouldValidate: true });
				if (source) setValue("source", source);
				if (notes) setValue("notes", notes);
			});
		},
		[setValue],
	);

	// A long paste anywhere in the dialog is a posting: read it.
	useEffect(() => {
		if (!open) return;
		function onPaste(e: ClipboardEvent) {
			const text = e.clipboardData?.getData("text") ?? "";
			if (text.trim().length < MIN_PASTE_LENGTH) return;
			e.preventDefault();
			extract(text);
		}
		document.addEventListener("paste", onPaste);
		return () => document.removeEventListener("paste", onPaste);
	}, [open, extract]);

	const busy = isSubmitting || isExtracting;
	const fieldError = (message?: string, name?: string) =>
		message && (
			<p id={`${id}-${name}-error`} role="alert" className="text-[0.8rem] text-destructive">
				{message}
			</p>
		);

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (isSubmitting) return;
				if (!v) draft.keep();
				onOpenChange(v);
			}}
		>
			<DialogContent
				className={cn(
					"max-sm:flex max-sm:flex-col sm:max-w-lg",
					instant && "data-[state=closed]:animate-none data-[state=open]:animate-none",
				)}
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					document.getElementById(`${id}-company`)?.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle>New Application</DialogTitle>
					<DialogDescription>
						{isExtracting ? (
							<span className="inline-flex items-center gap-2">
								<Spinner /> Reading the posting…
							</span>
						) : (
							"Paste a whole job posting to fill this in."
						)}
					</DialogDescription>
				</DialogHeader>

				<form
					onSubmit={handleSubmit(async (values) => {
						setError(null);
						const message = await onSave(values);
						if (message) setError(message);
						else onOpenChange(false);
					})}
					className="flex flex-1 flex-col gap-4"
				>
					<fieldset disabled={busy} className="contents">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor={`${id}-company`}>Company</Label>
								<Input
									id={`${id}-company`}
									autoComplete="off"
									aria-invalid={!!errors.company}
									aria-describedby={errors.company ? `${id}-company-error` : undefined}
									{...register("company")}
								/>
								{fieldError(errors.company?.message, "company")}
							</div>
							<div className="space-y-2">
								<Label htmlFor={`${id}-role`}>Role</Label>
								<Input
									id={`${id}-role`}
									autoComplete="off"
									aria-invalid={!!errors.role}
									aria-describedby={errors.role ? `${id}-role-error` : undefined}
									{...register("role")}
								/>
								{fieldError(errors.role?.message, "role")}
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor={`${id}-url`}>Posting link</Label>
							<Input
								id={`${id}-url`}
								type="url"
								inputMode="url"
								placeholder="https://…"
								aria-invalid={!!errors.jobUrl}
								{...register("jobUrl")}
							/>
							{fieldError(errors.jobUrl?.message, "url")}
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor={`${id}-status`}>Status</Label>
								<Controller
									control={control}
									name="status"
									render={({ field }) => (
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger id={`${id}-status`} className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{STATUSES.map((s) => (
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
								<Label htmlFor={`${id}-date`}>Sent on</Label>
								<Input id={`${id}-date`} type="date" {...register("dateApplied")} />
								{fieldError(errors.dateApplied?.message, "date")}
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor={`${id}-source`}>Source</Label>
							<Input
								id={`${id}-source`}
								list={`${id}-sources`}
								autoComplete="off"
								placeholder="Djinni, LinkedIn, a referral…"
								{...register("source")}
							/>
							<datalist id={`${id}-sources`}>
								{sources.map((s) => (
									<option key={s} value={s} />
								))}
							</datalist>
						</div>

						{showMore ? (
							<div className="animate-swap space-y-4">
								<div className="space-y-2">
									<Label htmlFor={`${id}-contact`}>Contact</Label>
									<Input
										id={`${id}-contact`}
										autoComplete="off"
										placeholder="Recruiter's name, email, Telegram…"
										{...register("contact")}
									/>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor={`${id}-location`}>Location</Label>
										<Input id={`${id}-location`} autoComplete="off" {...register("location")} />
									</div>
									<div className="space-y-2">
										<Label htmlFor={`${id}-salary`}>Salary</Label>
										<Input id={`${id}-salary`} autoComplete="off" {...register("salary")} />
									</div>
								</div>
								<ResumeUploadField
									fileUrl={watch("resumeFileUrl") ?? ""}
									fileName={watch("resumeFileName") ?? ""}
									resumeFiles={resumeFiles}
									onChange={(fileUrl, fileName) => {
										setValue("resumeFileUrl", fileUrl, { shouldValidate: true });
										setValue("resumeFileName", fileName);
									}}
								/>
							</div>
						) : (
							<QuietAdd onClick={() => setShowMore(true)}>
								Contact, location, salary, résumé
							</QuietAdd>
						)}

						<div className="space-y-2">
							<Label htmlFor={`${id}-notes`}>Notes</Label>
							<textarea
								id={`${id}-notes`}
								className={cn(FIELD_TEXTAREA, "min-h-20")}
								{...register("notes")}
							/>
						</div>
					</fieldset>

					{error && (
						<p role="alert" className="text-[0.8rem] text-destructive">
							{error}
						</p>
					)}

					<div className={FOOTER}>
						<Button
							type="button"
							variant="outline"
							className="max-sm:flex-1"
							disabled={isSubmitting}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" className="gap-1.5 max-sm:flex-1" disabled={busy}>
							{isSubmitting && <Spinner />}
							{isSubmitting ? "Adding…" : "Add"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
