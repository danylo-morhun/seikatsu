"use client";

import { type Theme, currentTheme, setTheme } from "@/lib/theme";
import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useEffect, useState } from "react";

export function ThemeToggle() {
	// Unknown until mounted: the server can't know the saved theme.
	const [theme, setThemeState] = useState<Theme | null>(null);

	useEffect(() => setThemeState(currentTheme()), []);

	if (!theme) {
		return <div className="h-8 w-8" />;
	}

	return (
		<Button
			variant="ghost"
			size="icon"
			className="h-8 w-8"
			onClick={() => {
				const next = theme === "dark" ? "light" : "dark";
				setTheme(next);
				setThemeState(next);
			}}
			aria-label="Toggle theme"
		>
			<HugeiconsIcon icon={theme === "dark" ? Sun01Icon : Moon02Icon} className="h-4 w-4" />
		</Button>
	);
}
