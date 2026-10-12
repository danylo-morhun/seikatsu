import { cn } from "../lib/utils";

interface AvatarProps {
	src?: string | null;
	name?: string | null;
	className?: string;
	size?: "sm" | "md" | "lg";
}

const SIZE = {
	sm: "h-6 w-6 text-xs tracking-tight",
	md: "h-8 w-8 text-xs",
	lg: "h-10 w-10 text-sm",
};

function initials(name?: string | null) {
	if (!name) return "?";
	return name
		.split(" ")
		.map((n) => n[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

export function Avatar({ src, name, className, size = "md" }: AvatarProps) {
	return (
		<div
			className={cn(
				"relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground",
				SIZE[size],
				className,
			)}
		>
			{src ? (
				<img src={src} alt={name ?? "avatar"} className="h-full w-full object-cover" />
			) : (
				<span>{initials(name)}</span>
			)}
		</div>
	);
}
