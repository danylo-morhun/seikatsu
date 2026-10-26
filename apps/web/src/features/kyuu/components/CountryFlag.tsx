import { cn } from "@seikatsu/ui";
import { countryName } from "../lib/country";

/**
 * A country's flag in a circle (flagsapi.com). The flat PNG is a 64px square with the flag
 * banded across its middle; scaled up, the flag fills the circle and the bands fall outside.
 * A plain <img>: tiny, cached by the browser, not worth the image optimiser.
 */
export function CountryFlag({ code, className }: { code: string; className?: string }) {
	const name = countryName(code);
	return (
		<span
			role="img"
			aria-label={name}
			title={name}
			className={cn(
				// The hairline sits above the image (an inset ring on the span would sit under it).
				"relative inline-block size-5 shrink-0 overflow-hidden rounded-full bg-surface-2 after:absolute after:inset-0 after:rounded-full after:ring-1 after:ring-foreground/15 after:ring-inset",
				className,
			)}
		>
			<img
				src={`https://flagsapi.com/${code}/flat/64.png`}
				alt=""
				loading="lazy"
				decoding="async"
				draggable={false}
				className="size-full scale-[1.55] object-cover"
			/>
		</span>
	);
}
