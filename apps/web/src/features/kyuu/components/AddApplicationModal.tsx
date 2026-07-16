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
import { createApplication } from "../actions/applications";
import {
	type ApplicationFormValues,
	applicationSchema,
	kyuuStatusValues,
} from "../lib/kyuu-schemas";
import { STATUS_CONFIG } from "./StatusBadge";

function today() {
	return new Date().toISOString().slice(0, 10);
}

export function AddApplicationModal({
	workspaceId,
	sources,
}: { workspaceId: string; sources: string[] }) {
	const [open, setOpen] = React.useState(false);
	const refresh = useRefreshRouter();

	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<ApplicationFormValues>({
		resolver: zodResolver(applicationSchema),
		defaultValues: {
			company: "",
			role: "",
			jobUrl: "",
			source: "",
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
		if (!val) reset();
	};

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
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>New Application</DialogTitle>
				</DialogHeader>

				<form
					onSubmit={handleSubmit(onSubmit, () => toast.error("Please check the form for errors"))}
					className="space-y-4"
				>
					<div className="space-y-2">
						<Label htmlFor="app-company">Company</Label>
						<Input id="app-company" placeholder="e.g. TENTENS Tech" {...register("company")} />
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
						{errors.role && <p className="text-destructive text-[0.8rem]">{errors.role.message}</p>}
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
									<Checkbox id="app-hr" checked={field.value} onCheckedChange={field.onChange} />
									HR Screening
								</label>
							)}
						/>
						<Controller
							control={control}
							name="technicalInterview"
							render={({ field }) => (
								<label htmlFor="app-tech" className="flex items-center gap-2 text-sm">
									<Checkbox id="app-tech" checked={field.value} onCheckedChange={field.onChange} />
									Technical Interview
								</label>
							)}
						/>
						<Controller
							control={control}
							name="offer"
							render={({ field }) => (
								<label htmlFor="app-offer" className="flex items-center gap-2 text-sm">
									<Checkbox id="app-offer" checked={field.value} onCheckedChange={field.onChange} />
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
				</form>
			</DialogContent>
		</Dialog>
	);
}
