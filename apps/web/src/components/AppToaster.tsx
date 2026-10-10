"use client";

import { Spinner } from "@/components/Spinner";
import {
	Alert02Icon,
	AlertCircleIcon,
	Cancel01Icon,
	CheckmarkCircle02Icon,
	InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useIsMobile } from "@seikatsu/ui";
import { Toaster } from "sonner";

// Status is told by a small icon in the fixed materials; the surface stays lacquer (globals.css).
const icons = {
	success: <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-positive" />,
	error: <HugeiconsIcon icon={AlertCircleIcon} size={16} className="text-negative" />,
	warning: <HugeiconsIcon icon={Alert02Icon} size={16} className="text-muted-foreground" />,
	info: <HugeiconsIcon icon={InformationCircleIcon} size={16} className="text-muted-foreground" />,
	loading: <Spinner className="size-4 text-muted-foreground" />,
	close: <HugeiconsIcon icon={Cancel01Icon} size={14} />,
};

// Phones: top-center under the 56px header, clear of the bottom nav pill and its centered action.
// Desktop: bottom-right, where nothing else lives.
const mobileOffset = { top: "calc(env(safe-area-inset-top) + 4rem)", left: 16, right: 16 };

export function AppToaster() {
	const isMobile = useIsMobile();
	return (
		<Toaster
			position={isMobile ? "top-center" : "bottom-right"}
			offset={isMobile ? mobileOffset : 24}
			mobileOffset={mobileOffset}
			visibleToasts={3}
			closeButton
			icons={icons}
		/>
	);
}
