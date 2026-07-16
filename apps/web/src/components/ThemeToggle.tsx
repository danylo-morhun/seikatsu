"use client";

import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	if (!mounted) {
		return <div className="h-8 w-8" />;
	}

	return (
		<Button
			variant="ghost"
			size="icon"
			className="h-8 w-8"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
			aria-label="Toggle theme"
		>
			<HugeiconsIcon icon={theme === "dark" ? Sun01Icon : Moon02Icon} className="h-4 w-4" />
		</Button>
	);
}
