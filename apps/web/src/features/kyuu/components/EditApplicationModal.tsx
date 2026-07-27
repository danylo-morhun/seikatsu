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
import type { getApplications } from "../actions/applications";
import { updateApplication } from "../actions/applications";
import {
	type ApplicationFormValues,
	applicationSchema,
	kyuuStatusValues,
} from "../lib/kyuu-schemas";
import { ResumeUploadField } from "./ResumeUploadField";
import { STATUS_CONFIG } from "./StatusBadge";

type Application = Awaited<ReturnType<typeof getApplications>>[number];

function toFormValues(app: Application): ApplicationFormValues {
	return {
		company: app.company,
		role: app.role,
		jobUrl: app.jobUrl ?? "",
		source: app.source ?? "",
		resumeFileUrl: app.resumeFileUrl ?? "",
		resumeFileName: app.resumeFileName ?? "",
		status: app.status,
		hrScreening: app.hrScreening,
		technicalInterview: app.technicalInterview,
		offer: app.offer,
		dateApplied: app.dateApplied,
		notes: app.notes ?? "",
	};
}

interface Props {
	application: Application;
	sources: string[];
	resumeFiles: ResumeFile[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function EditApplicationModal({
	application,
	sources,
	resumeFiles,
	open,
	onOpenChange,
}: Props) {
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
		defaultValues: toFormValues(application),
	});

	React.useEffect(() => {
		if (open) reset(toFormValues(application));
	}, [open, application, reset]);

	const onSubmit = async (values: ApplicationFormValues) => {
		const result = await updateApplication(application.id, values);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		toast.success("Application updated");
		refresh();
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md max-w-full overflow-x-hidden">
				<DialogHeader>
					<DialogTitle>Edit Application</DialogTitle>
				</DialogHeader>

				<form
					onSubmit={handleSubmit(onSubmit, () => toast.error("Please check the form for errors"))}
					className="space-y-4 min-w-0"
				>
					<div className="space-y-2">
						<Label htmlFor="edit-app-company">Company</Label>
						<Input id="edit-app-company" {...register("company")} />
						{errors.company && (
							<p className="text-destructive text-[0.8rem]">{errors.company.message}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-app-role">Role</Label>
						<Input id="edit-app-role" {...register("role")} />
						{errors.role && <p className="text-destructive text-[0.8rem]">{errors.role.message}</p>}
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-app-url">Job Link (optional)</Label>
						<Input id="edit-app-url" placeholder="https://…" {...register("jobUrl")} />
						{errors.jobUrl && (
							<p className="text-destructive text-[0.8rem]">{errors.jobUrl.message}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-app-source">Source (optional)</Label>
						<Input id="edit-app-source" list="kyuu-sources-edit" {...register("source")} />
						<datalist id="kyuu-sources-edit">
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
						<Label htmlFor="edit-app-date">Date Applied</Label>
						<Input id="edit-app-date" type="date" {...register("dateApplied")} />
						{errors.dateApplied && (
							<p className="text-destructive text-[0.8rem]">{errors.dateApplied.message}</p>
						)}
					</div>

					<div className="flex flex-wrap gap-4">
						<Controller
							control={control}
							name="hrScreening"
							render={({ field }) => (
								<label htmlFor="edit-app-hr" className="flex items-center gap-2 text-sm">
									<Checkbox
										id="edit-app-hr"
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
								<label htmlFor="edit-app-tech" className="flex items-center gap-2 text-sm">
									<Checkbox
										id="edit-app-tech"
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
								<label htmlFor="edit-app-offer" className="flex items-center gap-2 text-sm">
									<Checkbox
										id="edit-app-offer"
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
									Offer
								</label>
							)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-app-notes">Notes (optional)</Label>
						<textarea
							id="edit-app-notes"
							rows={3}
							className="border-input dark:bg-input/30 flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
							{...register("notes")}
						/>
					</div>

					<div className="flex justify-end gap-2 pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting} className="gap-1.5">
							{isSubmitting && <Spinner />}
							{isSubmitting ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
