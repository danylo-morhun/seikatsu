/** ⌘K on a Mac, Ctrl+K elsewhere: opens capture from anywhere, even while typing. By `code`, so
 * it works on any keyboard layout (Cyrillic included). */
export function isCaptureKey(e: {
	code: string;
	metaKey: boolean;
	ctrlKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
}): boolean {
	return e.code === "KeyK" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
}
