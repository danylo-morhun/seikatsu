"use client";

import { QuietAdd } from "@/components/QuietAdd";
import { Spinner } from "@/components/Spinner";
import { FOOTER } from "@/features/keizoku/components/HabitDialog";
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
import type { ApplicationDetail, ResumeFile } from "../lib/types";
import { ResumeUploadField } from "./ResumeUploadField";

export const FIELD_TEXTAREA =
	"w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-colors [field-sizing:content] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

/** A paste this long is a job posting, not a company name. */
const MIN_PASTE_LENGTH = 200;

function valuesOf(app: ApplicationDetail | null): ApplicationFormValues {
	return {
		company: app?.company ?? "",
		role: app?.role ?? "",
		jobUrl: app?.jobUrl ?? "",
		source: app?.source ?? "",
		status: app?.status ?? "applied",
		dateApplied: app?.dateApplied ?? localToday(),
		contact: app?.contact ?? "",
		salary: app?.salary ?? "",
		location: app?.location ?? "",
		notes: app?.notes ?? "",
		resumeFileUrl: app?.resumeFileUrl ?? "",
		resumeFileName: app?.resumeFileName ?? "",
	};
}

interface Props {
	/** Null: a new application. */
	application: ApplicationDetail | null;
	open: boolean;
	/** Opened by a key: no zoom in or out. */
	instant?: boolean;
	onOpenChange: (open: boolean) => void;
	sources: string[];
	resumeFiles: ResumeFile[];
	/** Resolves to an error message, or nothing when saved. */
	onSave: (values: ApplicationFormValues) => Promise<string | undefined>;
}

/** New and Edit application: the posting's facts. Pasting a whole posting fills them in. */
export function ApplicationDialog({
	application,
	open,
	instant = false,
	onOpenChange,
	sources,
	resumeFiles,
	onSave,
}: Props) {
	const id = useId();
	const isNew = application == null;
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
		defaultValues: valuesOf(application),
	});

	// Each opening starts from the application (or blank), never from the last one's leftovers.
	useEffect(() => {
		if (!open) return;
		reset(valuesOf(application));
		setShowMore(
			!!(
				application?.contact ||
				application?.salary ||
				application?.location ||
				application?.resumeFileUrl
			),
		);
		setError(null);
	}, [open, application, reset]);

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

	// A long paste anywhere in a new application's dialog is a posting: read it.
	useEffect(() => {
		if (!open || !isNew) return;
		function onPaste(e: ClipboardEvent) {
			const text = e.clipboardData?.getData("text") ?? "";
			if (text.trim().length < MIN_PASTE_LENGTH) return;
			e.preventDefault();
			extract(text);
		}
		document.addEventListener("paste", onPaste);
		return () => document.removeEventListener("paste", onPaste);
	}, [open, isNew, extract]);

	const busy = isSubmitting || isExtracting;
	const fieldError = (message?: string, name?: string) =>
		message && (
			<p id={`${id}-${name}-error`} role="alert" className="text-[0.8rem] text-destructive">
				{message}
			</p>
		);

	return (
		<Dialog open={open} onOpenChange={(v) => !isSubmitting && onOpenChange(v)}>
			<DialogContent
				className={cn(
					"max-sm:flex max-sm:flex-col sm:max-w-lg",
					instant && "data-[state=closed]:animate-none data-[state=open]:animate-none",
				)}
				onOpenAutoFocus={(e) => {
					// A new one starts at the company; an edit doesn't pull the phone's keyboard up.
					e.preventDefault();
					if (isNew) document.getElementById(`${id}-company`)?.focus({ preventScroll: true });
				}}
			>
				<DialogHeader>
					<DialogTitle>{isNew ? "New Application" : "Edit Application"}</DialogTitle>
					<DialogDescription className={cn(!isNew && "sr-only")}>
						{isExtracting ? (
							<span className="inline-flex items-center gap-2">
								<Spinner /> Reading the posting…
							</span>
						) : isNew ? (
							"Paste a whole job posting to fill this in."
						) : (
							"The posting's facts. Notes and the timeline are on the application."
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

						{isNew && (
							<div className="space-y-2">
								<Label htmlFor={`${id}-notes`}>Notes</Label>
								<textarea
									id={`${id}-notes`}
									className={cn(FIELD_TEXTAREA, "min-h-20")}
									{...register("notes")}
								/>
							</div>
						)}
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
							{isSubmitting ? "Saving…" : isNew ? "Add" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
