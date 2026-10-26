import { cn } from "@seikatsu/ui";
import { countryName } from "../lib/country";

/**
 * A country's flag in a circle (flagsapi.com). The flat PNG is a 64px square with the flag
 * drawn 64×40 across its middle (rows 12–51) and transparent bands above and below. Scaled
 * by 64/40 = 1.6 the flag just covers the circle; 1.7 keeps the antialiased edges outside too.
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
				className="size-full scale-[1.7] object-cover"
			/>
		</span>
	);
}
