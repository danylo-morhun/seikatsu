"use client";

import { usePendingProgress } from "@/hooks/usePendingProgress";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

export function useRefreshRouter() {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	usePendingProgress(isPending);

	return useCallback(() => {
		startTransition(() => router.refresh());
	}, [router, startTransition]);
}
