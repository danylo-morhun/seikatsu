import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
	const [isMobile, setIsMobile] = React.useState(false);

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		// A transition, not an urgent update: this changes the sidebar context right after
		// hydration, and an urgent context change makes React drop the server HTML of any
		// page segment whose JS hasn't loaded yet (it flashes the loading screen). A
		// transition instead waits for those segments to hydrate.
		const onChange = () => {
			React.startTransition(() => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT));
		};
		mql.addEventListener("change", onChange);
		onChange();
		return () => mql.removeEventListener("change", onChange);
	}, []);

	return isMobile;
}
