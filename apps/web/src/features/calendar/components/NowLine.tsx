"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

const minutesNow = () => {
	const d = new Date();
	return d.getHours() * 60 + d.getMinutes();
};

/** The time now across today's column, moved once a minute. Drawn only in the browser. */
export function NowLine({ from, to, hour }: { from: number; to: number; hour: number }) {
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(minutesNow());
		const id = setInterval(() => setNow(minutesNow()), 60_000);
		return () => clearInterval(id);
	}, []);
	if (now == null || now < from * 60 || now > to * 60) return null;
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-x-0 top-(--top) z-10 h-px bg-primary"
			style={{ "--top": `${((now - from * 60) / 60) * hour}px` } as CSSProperties}
		>
			<span className="absolute -top-1 -left-1 size-2 rounded-full bg-primary" />
		</div>
	);
}
