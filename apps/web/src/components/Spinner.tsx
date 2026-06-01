"use client";

import { cn } from "@seikatsu/ui";

export function Spinner({ className }: { className?: string }) {
	return (
		<svg
			className={cn("h-3.5 w-3.5 animate-spin", className)}
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			role="img"
			aria-label="Loading"
		>
			<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
			/>
		</svg>
	);
}
