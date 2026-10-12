"use client";

import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@seikatsu/ui";
import { useRef } from "react";

interface Props {
	/** The data attribute that names an item, e.g. "data-card-id". */
	attr: string;
	/** Right-click on an item; return false to leave the browser's own menu. */
	onTarget: (id: string) => boolean;
	onClose?: () => void;
	/** The items for the current target. */
	menu: React.ReactNode;
	children: React.ReactNode;
}

// A touch this recent made the contextmenu event (Android's long press).
const TOUCH_WINDOW_MS = 1500;

/**
 * One context menu for a whole list: a right-click finds the item under the pointer by its
 * data attribute, so the rows stay light. Mouse only: on touch a long press lifts the item
 * for dragging, and a tap opens it.
 */
export function ContextArea({ attr, onTarget, onClose, menu, children }: Props) {
	const lastTouch = useRef(Number.NEGATIVE_INFINITY);

	return (
		<ContextMenu onOpenChange={(open) => !open && onClose?.()}>
			<ContextMenuTrigger
				asChild
				onPointerDown={(e) => {
					if (e.pointerType === "mouse") return;
					lastTouch.current = e.timeStamp;
					// Skips Radix's own long-press timer.
					e.preventDefault();
				}}
			>
				<div className="contents">
					<div
						className="contents"
						onContextMenu={(e) => {
							if (e.timeStamp - lastTouch.current < TOUCH_WINDOW_MS) {
								e.preventDefault();
								e.stopPropagation();
								return;
							}
							const id = (e.target as Element).closest(`[${attr}]`)?.getAttribute(attr);
							// Not on an item: the browser's menu, not ours.
							if (!id || !onTarget(id)) e.stopPropagation();
						}}
					>
						{children}
					</div>
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-56">{menu}</ContextMenuContent>
		</ContextMenu>
	);
}

/** Opens the area's menu for `el` from the keyboard, at the element's top-left corner. */
export function openContextMenu(el: HTMLElement) {
	const rect = el.getBoundingClientRect();
	el.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			clientX: rect.left + 12,
			clientY: rect.top + 12,
		}),
	);
}
