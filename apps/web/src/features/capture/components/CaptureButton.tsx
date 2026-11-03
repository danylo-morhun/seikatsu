"use client";

import { QuillWrite01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@seikatsu/ui";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Kbd } from "@/components/Kbd";
import { isCaptureKey } from "@/features/capture/lib/key";

// The dialog (and its server action) loads on first open, so no page ships it up front.
const CaptureDialog = dynamic(() =>
	import("@/features/capture/components/CaptureDialog").then((m) => m.CaptureDialog),
);

const loadDialog = () => void import("@/features/capture/components/CaptureDialog");

/** The header's capture: one line into any app. ⌘K / Ctrl+K opens it from anywhere. */
export function CaptureButton() {
	const [open, setOpen] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (!isCaptureKey(e)) return;
			e.preventDefault();
			setMounted(true);
			setOpen(true);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="md:size-8"
						aria-label="Capture"
						aria-keyshortcuts="Meta+K Control+K"
						onPointerEnter={loadDialog}
						onFocus={loadDialog}
						onClick={() => {
							setMounted(true);
							setOpen(true);
						}}
					>
						<HugeiconsIcon icon={QuillWrite01Icon} className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent className="flex items-center gap-2">
					Capture
					<Kbd className="h-5 min-w-5">⌘K</Kbd>
				</TooltipContent>
			</Tooltip>
			{mounted && <CaptureDialog open={open} onOpenChange={setOpen} />}
		</>
	);
}
