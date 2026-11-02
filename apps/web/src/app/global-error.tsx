"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort boundary (root layout crashed): report, offer a reload.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<html lang="en" className="dark">
			<body className="flex min-h-dvh items-center justify-center bg-background text-foreground">
				<div className="flex flex-col items-center gap-3 text-center">
					<p className="text-lg">Something went wrong.</p>
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="rounded-button bg-primary px-4 py-2 text-primary-foreground"
					>
						Reload
					</button>
				</div>
			</body>
		</html>
	);
}
