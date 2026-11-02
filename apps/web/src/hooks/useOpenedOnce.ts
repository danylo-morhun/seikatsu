import { useState } from "react";

/**
 * True from the first time `open` is true. Mount a lazy dialog only once it's wanted, then keep
 * it mounted so it can animate out.
 */
export function useOpenedOnce(open: boolean) {
	const [opened, setOpened] = useState(open);
	if (open && !opened) setOpened(true);
	return opened || open;
}
