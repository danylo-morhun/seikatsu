"use client";

import { type ComponentProps, lazy, Suspense } from "react";
import type { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";

// The form (zod, react-hook-form, the pickers) loads in its own chunk, after the page hydrates.
const Modal = lazy(() =>
	import("@/features/kuroji/components/AddTransactionModal").then((m) => ({
		default: m.AddTransactionModal,
	})),
);

/**
 * AddTransactionModal, code-split. The server still renders it; until the code arrives on a
 * client navigation, the trigger stands in so nothing jumps.
 */
export function LazyAddTransactionModal(props: ComponentProps<typeof AddTransactionModal>) {
	return (
		<Suspense fallback={props.trigger ?? null}>
			<Modal {...props} />
		</Suspense>
	);
}
