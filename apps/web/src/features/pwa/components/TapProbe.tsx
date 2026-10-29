"use client";

import { isStandalone } from "@/features/pwa/lib/push-client";
import { useEffect } from "react";
import { toast } from "sonner";

// TEMPORARY: taps don't reach the page in the iOS Home Screen app. Shows what sits under the
// finger on each tap there. Remove once found.
function describe(el: Element | null) {
	if (!el) return "null";
	const cls = typeof el.className === "string" ? el.className.slice(0, 60) : "";
	return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} ${cls}`;
}

export function TapProbe() {
	useEffect(() => {
		if (!isStandalone()) return;
		const onDown = (e: PointerEvent) => {
			const hit = document.elementFromPoint(e.clientX, e.clientY);
			const vv = window.visualViewport;
			const lines = [
				`xy ${Math.round(e.clientX)},${Math.round(e.clientY)} · vv top ${vv?.offsetTop ?? "-"} h ${vv?.height ?? "-"} / ${window.innerHeight} · scrollY ${window.scrollY}`,
				`target: ${describe(e.target as Element)}`,
				`hit: ${describe(hit)}`,
				`body pe ${getComputedStyle(document.body).pointerEvents} · style "${document.body.getAttribute("style") ?? ""}"`,
				`inert ${document.querySelectorAll("[inert]").length} · open ${document.querySelectorAll("[data-state=open]").length} · modal ${document.querySelectorAll("[aria-modal=true]").length}`,
			];
			toast("Tap probe", {
				id: "tap-probe",
				description: <pre className="text-xs whitespace-pre-wrap">{lines.join("\n")}</pre>,
				duration: 20000,
			});
		};
		window.addEventListener("pointerdown", onDown, true);
		return () => window.removeEventListener("pointerdown", onDown, true);
	}, []);
	return null;
}
