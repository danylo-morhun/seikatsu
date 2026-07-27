"use client";

import { Spinner } from "@/components/Spinner";
import { Delete01Icon, Download01Icon, ImageUpload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import * as React from "react";
import { toast } from "sonner";
import type { ResumeFile } from "../actions/applications";
import { uploadResumeFile } from "../actions/resume";

interface Props {
	fileUrl: string;
	fileName: string;
	resumeFiles: ResumeFile[];
	onChange: (fileUrl: string, fileName: string) => void;
}

export function ResumeUploadField({ fileUrl, fileName, resumeFiles, onChange }: Props) {
	const [isUploading, startUploading] = React.useTransition();
	const inputRef = React.useRef<HTMLInputElement>(null);

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		startUploading(async () => {
			const formData = new FormData();
			formData.set("file", file);
			const result = await uploadResumeFile(formData);
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			onChange(result.fileUrl, result.fileName);
		});
	}

	const reusable = resumeFiles.filter((r) => r.fileUrl !== fileUrl);

	return (
		<div className="space-y-2">
			<Label>Resume (optional)</Label>
			<input
				ref={inputRef}
				type="file"
				accept=".pdf,.doc,.docx"
				className="sr-only"
				tabIndex={-1}
				onChange={handleFileChange}
			/>
			{fileUrl && fileName ? (
				<div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm min-w-0 w-full overflow-hidden">
					<span className="flex-1 min-w-0 truncate" title={fileName}>
						{fileName}
					</span>
					<a
						href={fileUrl}
						target="_blank"
						rel="noopener noreferrer"
						download={fileName}
						className="shrink-0 text-muted-foreground hover:text-foreground"
						aria-label="Download resume"
					>
						<HugeiconsIcon icon={Download01Icon} className="h-4 w-4" />
					</a>
					<button
						type="button"
						onClick={() => onChange("", "")}
						className="shrink-0 text-muted-foreground hover:text-destructive"
						aria-label="Remove resume"
					>
						<HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
					</button>
				</div>
			) : (
				<div className="flex flex-wrap items-center gap-2 max-w-full">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={isUploading}
						className="shrink-0 gap-1.5"
						onClick={() => inputRef.current?.click()}
					>
						{isUploading ? (
							<Spinner />
						) : (
							<HugeiconsIcon icon={ImageUpload01Icon} className="h-4 w-4" />
						)}
						{isUploading ? "Uploading…" : "Upload Resume"}
					</Button>
					{reusable.length > 0 && (
						<Select
							value=""
							onValueChange={(val) => {
								const picked = reusable.find((r) => r.fileUrl === val);
								if (picked) onChange(picked.fileUrl, picked.fileName);
							}}
						>
							<SelectTrigger className="h-8 max-w-[180px] min-w-0 text-xs">
								<SelectValue placeholder="Reuse previous…" />
							</SelectTrigger>
							<SelectContent className="max-w-[300px]">
								{reusable.map((r) => (
									<SelectItem key={r.fileUrl} value={r.fileUrl}>
										<span className="block max-w-[220px] truncate" title={r.fileName}>
											{r.fileName}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
			)}
			<p className="text-xs text-muted-foreground">PDF or Word · max 5 MB</p>
		</div>
	);
}
