"use client";

import { useIsMobile } from "@seikatsu/ui";
import { Toaster } from "sonner";

// Phones: top-center under the 56px header, clear of the bottom nav pill and its centered action.
// Desktop: bottom-right, where nothing else lives.
const mobileOffset = { top: "calc(env(safe-area-inset-top) + 4rem)", left: 16, right: 16 };

export function AppToaster() {
	const isMobile = useIsMobile();
	return (
		<Toaster
			richColors
			position={isMobile ? "top-center" : "bottom-right"}
			offset={isMobile ? mobileOffset : 24}
			mobileOffset={mobileOffset}
			visibleToasts={3}
		/>
	);
}
