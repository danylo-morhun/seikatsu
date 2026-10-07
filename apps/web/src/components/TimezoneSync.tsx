"use client";

import { useEffect } from "react";

/** Stores the browser's IANA time zone in the `tz` cookie so the server can resolve "today". */
export function TimezoneSync() {
	useEffect(() => {
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (!zone || document.cookie.includes(`tz=${encodeURIComponent(zone)}`)) return;
		document.cookie = `tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
	}, []);

	return null;
}
