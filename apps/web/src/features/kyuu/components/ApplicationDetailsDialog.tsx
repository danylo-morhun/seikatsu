"use client";

import { Spinner } from "@/components/Spinner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@seikatsu/ui";
import * as React from "react";
import { toast } from "sonner";
import type { ApplicationDetails, getApplications } from "../actions/applications";
import { getApplicationDetails } from "../actions/applications";

type Application = Awaited<ReturnType<typeof getApplications>>["rows"][number];

interface Props {
	application: Application;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function TextBlock({ text, empty }: { text: string | null; empty: string }) {
	if (!text) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
	return (
		<div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
			{text}
		</div>
	);
}

export function ApplicationDetailsDialog({ application, open, onOpenChange }: Props) {
	const [details, setDetails] = React.useState<ApplicationDetails | null>(null);

	React.useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setDetails(null);
		getApplicationDetails(application.id).then((result) => {
			if (cancelled) return;
			if ("error" in result) {
				toast.error(result.error);
				onOpenChange(false);
			} else {
				setDetails(result.data);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [open, application.id, onOpenChange]);

	const meta = details
		? [
				details.location,
				details.remote === true ? "Remote" : details.remote === false ? "On-site / hybrid" : null,
				details.salary,
			].filter(Boolean)
		: [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl max-w-full overflow-x-hidden">
				<DialogHeader>
					<DialogTitle>{application.company}</DialogTitle>
					<DialogDescription>{application.role}</DialogDescription>
				</DialogHeader>

				{!details ? (
					<div className="flex justify-center py-10">
						<Spinner />
					</div>
				) : (
					<div className="min-w-0 space-y-4">
						{(details.fitVerdict || meta.length > 0 || details.stackTags?.length) && (
							<div className="space-y-2 text-sm">
								{details.fitVerdict && <p className="font-medium">{details.fitVerdict}</p>}
								{meta.length > 0 && <p className="text-muted-foreground">{meta.join(" · ")}</p>}
								{details.stackTags && details.stackTags.length > 0 && (
									<div className="flex flex-wrap gap-1.5">
										{details.stackTags.map((tag) => (
											<span
												key={tag}
												className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground"
											>
												{tag}
											</span>
										))}
									</div>
								)}
							</div>
						)}

						<Tabs defaultValue="job">
							<TabsList>
								<TabsTrigger value="job">Job description</TabsTrigger>
								<TabsTrigger value="letter">Cover letter</TabsTrigger>
							</TabsList>
							<TabsContent value="job">
								<TextBlock text={details.jobDescription} empty="No job description saved." />
							</TabsContent>
							<TabsContent value="letter">
								<TextBlock text={details.coverLetter} empty="No cover letter saved." />
							</TabsContent>
						</Tabs>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
