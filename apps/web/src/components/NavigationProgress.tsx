"use client";

import { useEffect, useRef, useState } from "react";

type State = "idle" | "running" | "done";

export function NavigationProgress() {
	const [state, setState] = useState<State>("idle");
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	function start() {
		if (timerRef.current) clearTimeout(timerRef.current);
		setState("running");
	}

	function complete() {
		setState("done");
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => setState("idle"), 400);
	}

	// Mutation progress only (data refreshes, not navigation)
	useEffect(() => {
		function handleRefreshStart() {
			start();
		}
		function handleRefreshEnd() {
			complete();
		}
		window.addEventListener("seikatsu:refresh-start", handleRefreshStart);
		window.addEventListener("seikatsu:refresh-end", handleRefreshEnd);
		return () => {
			window.removeEventListener("seikatsu:refresh-start", handleRefreshStart);
			window.removeEventListener("seikatsu:refresh-end", handleRefreshEnd);
		};
	}, []);

	if (state === "idle") return null;

	return (
		<div className="fixed inset-x-0 top-0 z-[9999] h-[2px] overflow-hidden" aria-hidden>
			<div
				className={
					state === "running"
						? "h-full bg-primary transition-all duration-[5000ms] ease-out"
						: "h-full bg-primary transition-all duration-300 ease-in"
				}
				style={{ width: state === "running" ? "85%" : "100%", transformOrigin: "left" }}
			/>
		</div>
	);
}
