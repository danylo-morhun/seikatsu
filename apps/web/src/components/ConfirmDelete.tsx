"use client";

import { Spinner } from "@/components/Spinner";
import { useHeld } from "@/hooks/useHeld";
import { Alert01Icon, Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@seikatsu/ui";
import { useTransition } from "react";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	/** Resolves when done; the dialog stays open (and pending) until then. */
	onConfirm: () => Promise<unknown> | undefined;
	/** A choice that shapes what goes, between the description and the buttons. */
	children?: React.ReactNode;
	/** The action's name when it isn't a plain delete ("Clear day"). */
	confirmLabel?: string;
}

/** Kuroji's delete confirmation: alert icon in the title, destructive action, "Deleting…". */
export function ConfirmDelete({
	open,
	onOpenChange,
	title,
	description,
	onConfirm,
	children,
	confirmLabel = "Delete",
}: Props) {
	const [isPending, startTransition] = useTransition();
	// The subject is usually cleared as it closes: keep its words through the exit.
	const shown = useHeld({ title, description, children, confirmLabel }, open);
	const label = shown.confirmLabel;
	const pendingLabel = label.startsWith("Delete")
		? "Deleting…"
		: label.startsWith("Clear")
			? "Clearing…"
			: label.startsWith("Turn off")
				? "Turning off…"
				: label.startsWith("Close")
					? "Closing…"
					: `${label}…`;

	function handleConfirm(e: React.MouseEvent) {
		e.preventDefault();
		startTransition(async () => {
			await onConfirm();
			onOpenChange(false);
		});
	}

	return (
		<AlertDialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						<HugeiconsIcon icon={Alert01Icon} className="h-5 w-5 shrink-0 text-destructive" />
						<span className="min-w-0 break-words">{shown.title}</span>
					</AlertDialogTitle>
					<AlertDialogDescription>{shown.description}</AlertDialogDescription>
				</AlertDialogHeader>
				{shown.children}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
						disabled={isPending}
						onClick={handleConfirm}
					>
						{isPending ? <Spinner /> : <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />}
						{isPending ? pendingLabel : label}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
