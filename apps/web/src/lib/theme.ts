// Theme switching without a React context (see components/ThemeProvider.tsx for why).
// Mirrors next-themes: class on <html>, color-scheme, "theme" in localStorage, and no CSS
// transitions during the switch.

export type Theme = "light" | "dark";

export function currentTheme(): Theme {
	return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function setTheme(theme: Theme) {
	const root = document.documentElement;
	const noTransitions = document.createElement("style");
	noTransitions.textContent = "*,*::before,*::after{transition:none!important}";
	document.head.appendChild(noTransitions);

	root.classList.remove("light", "dark");
	root.classList.add(theme);
	root.style.colorScheme = theme;
	try {
		localStorage.setItem("theme", theme);
	} catch {}

	// Force a style flush before transitions come back.
	window.getComputedStyle(document.body);
	setTimeout(() => noTransitions.remove(), 1);
}
