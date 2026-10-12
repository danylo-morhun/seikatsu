"use client";

import { Kbd } from "@/components/Kbd";
import { pageKey } from "@/lib/capture-shortcut";
import { SHORTCUTS_EVENT, hasAppShortcuts, shortcutsFor } from "@/lib/shortcuts";
import { KeyboardIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	cn,
} from "@seikatsu/ui";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** The header's way in to the "?" sheet, so the key is found without knowing it. Desktop only. */
export function ShortcutsButton() {
	const pathname = usePathname();
	if (!hasAppShortcuts(pathname)) return null;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="max-md:hidden md:size-8"
					aria-label="Keyboard shortcuts"
					aria-keyshortcuts="?"
					onClick={() => window.dispatchEvent(new CustomEvent(SHORTCUTS_EVENT))}
				>
					<HugeiconsIcon icon={KeyboardIcon} className="h-4 w-4" />
				</Button>
			</TooltipTrigger>
			<TooltipContent className="flex items-center gap-2">
				Keyboard shortcuts
				<Kbd className="h-5 min-w-5">?</Kbd>
			</TooltipContent>
		</Tooltip>
	);
}

/** The "?" sheet: this app's shortcuts, then the ones that work anywhere. */
export function KeyboardShortcuts() {
	const pathname = usePathname();
	const [open, setOpen] = useState(false);
	// From the keyboard it appears without motion (a shortcut is for speed).
	const [instant, setInstant] = useState(false);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (pageKey(e) !== "?") return;
			e.preventDefault();
			setInstant(true);
			setOpen(true);
		}
		function onRequest() {
			setInstant(false);
			setOpen(true);
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(SHORTCUTS_EVENT, onRequest);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(SHORTCUTS_EVENT, onRequest);
		};
	}, []);

	const groups = shortcutsFor(pathname);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				className={cn(
					"max-h-[85dvh] gap-0 overflow-y-auto sm:max-w-md [scrollbar-width:thin]",
					instant && "data-[state=closed]:animate-none data-[state=open]:animate-none",
				)}
			>
				<DialogHeader className="pb-2">
					<DialogTitle>Keyboard shortcuts</DialogTitle>
					<DialogDescription>
						Single keys, whenever you aren't typing. Any keyboard layout works.
					</DialogDescription>
				</DialogHeader>
				{groups.map((group) => (
					<section key={group.title} className="pt-4">
						<h3 className="pb-1 text-xs font-medium text-muted-foreground">{group.title}</h3>
						<ul>
							{group.items.map((item) => (
								<li
									key={item.label}
									className="flex items-center justify-between gap-4 border-b border-rule py-2 text-sm last:border-b-0"
								>
									<span>{item.label}</span>
									<span className="flex shrink-0 gap-1">
										{item.keys.map((key) => (
											<Kbd key={key}>{key}</Kbd>
										))}
									</span>
								</li>
							))}
						</ul>
					</section>
				))}
			</DialogContent>
		</Dialog>
	);
}
