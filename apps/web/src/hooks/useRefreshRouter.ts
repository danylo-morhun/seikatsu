"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";

export function useRefreshRouter() {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const hasStarted = useRef(false);

	useEffect(() => {
		if (isPending) {
			hasStarted.current = true;
			window.dispatchEvent(new CustomEvent("seikatsu:refresh-start"));
		} else if (hasStarted.current) {
			hasStarted.current = false;
			window.dispatchEvent(new CustomEvent("seikatsu:refresh-end"));
		}
	}, [isPending]);

	return useCallback(() => {
		startTransition(() => router.refresh());
	}, [router, startTransition]);
}
