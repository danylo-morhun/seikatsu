import { Book01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";

interface Props {
	coverUrl: string | null;
	title: string;
	className?: string;
}

/** Book cover with a graceful placeholder when no image is available. */
export function BookCover({ coverUrl, title, className }: Props) {
	return (
		<div
			className={cn(
				"relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-md bg-muted",
				className,
			)}
		>
			{coverUrl ? (
				<img src={coverUrl} alt={title} loading="lazy" className="h-full w-full object-cover" />
			) : (
				<div className="flex flex-col items-center gap-2 p-3 text-center text-muted-foreground">
					<HugeiconsIcon icon={Book01Icon} className="h-7 w-7 opacity-50" />
					<span className="line-clamp-3 text-[11px] leading-tight">{title}</span>
				</div>
			)}
		</div>
	);
}
