"use client";

import { useEffect, useState } from "react";

export function MidasContentShell({ children }: { children: React.ReactNode }) {
	const [refreshing, setRefreshing] = useState(false);

	useEffect(() => {
		function onStart() {
			setRefreshing(true);
		}
		function onEnd() {
			setRefreshing(false);
		}
		window.addEventListener("seikatsu:refresh-start", onStart);
		window.addEventListener("seikatsu:refresh-end", onEnd);
		return () => {
			window.removeEventListener("seikatsu:refresh-start", onStart);
			window.removeEventListener("seikatsu:refresh-end", onEnd);
		};
	}, []);

	return (
		<div
			className={
				refreshing
					? "pointer-events-none opacity-50 transition-opacity duration-150"
					: "transition-opacity duration-150"
			}
		>
			{children}
		</div>
	);
}
