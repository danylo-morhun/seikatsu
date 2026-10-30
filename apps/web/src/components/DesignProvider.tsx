"use client";

import { DESIGN_COOKIE, type Design } from "@/lib/design";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const DesignContext = createContext<{ design: Design; setDesign: (design: Design) => void }>({
	design: "glass",
	setDesign: () => {},
});

/**
 * The look for components that render differently, not just restyle (header tabs, the phone
 * tab bar, the sidebar). Seeded from the cookie on the server, so it never changes after mount
 * unless the user switches it.
 */
export function DesignProvider({
	initial,
	children,
}: {
	initial: Design;
	children: React.ReactNode;
}) {
	const [design, setState] = useState(initial);
	const setDesign = useCallback((next: Design) => {
		document.cookie = `${DESIGN_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
		document.documentElement.dataset.design = next;
		setState(next);
	}, []);
	const value = useMemo(() => ({ design, setDesign }), [design, setDesign]);
	return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
}

export function useDesign() {
	return useContext(DesignContext);
}
