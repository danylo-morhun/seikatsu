"use client";

import { type Theme, currentTheme, setTheme } from "@/lib/theme";
import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export function ThemeToggle() {
	// Unknown until mounted: the server can't know the saved theme.
	const [theme, setThemeState] = useState<Theme | null>(null);

	useEffect(() => setThemeState(currentTheme()), []);

	if (!theme) {
		return <div className="size-10 md:size-8" />;
	}

	function toggle(origin: HTMLElement) {
		const next = theme === "dark" ? "light" : "dark";
		const apply = () => {
			setTheme(next);
			flushSync(() => setThemeState(next));
		};

		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (!document.startViewTransition || reduce) {
			apply();
			return;
		}

		// The new theme spreads out from the toggle as a widening circle of lacquer.
		const { left, top, width, height } = origin.getBoundingClientRect();
		const x = left + width / 2;
		const y = top + height / 2;
		const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
		document.documentElement.style.setProperty("--theme-x", `${x}px`);
		document.documentElement.style.setProperty("--theme-y", `${y}px`);
		const transition = document.startViewTransition(apply);
		transition.ready
			.then(() => {
				document.documentElement.animate(
					{
						clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
					},
					{
						duration: 700,
						easing: "cubic-bezier(0.23, 1, 0.32, 1)",
						fill: "both",
						pseudoElement: "::view-transition-new(root)",
					},
				);
			})
			.catch(() => {});
	}

	return (
		<Button
			variant="ghost"
			size="icon"
			className="md:size-8"
			onClick={(e) => toggle(e.currentTarget)}
			aria-label="Toggle theme"
		>
			<HugeiconsIcon
				key={theme}
				icon={theme === "dark" ? Sun01Icon : Moon02Icon}
				className="h-4 w-4 animate-in spin-in-[-90deg] zoom-in-50 fade-in-0 duration-300 ease-out"
			/>
		</Button>
	);
}
