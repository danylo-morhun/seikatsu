import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

/** A stale or mistyped link: say so in the board's place, with the way back. */
export default function SeiryuNotFound() {
	return (
		<div className="flex flex-col items-start gap-4 px-4 py-16 sm:px-8">
			<div>
				<h1 className="font-medium">Nothing here</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					This card or project doesn't exist any more, or the link is mistyped.
				</p>
			</div>
			<Link
				href="/seiryu"
				prefetch
				className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden className="size-4" />
				Back to your boards
			</Link>
		</div>
	);
}
