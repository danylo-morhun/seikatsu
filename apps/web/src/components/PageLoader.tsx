"use client";

interface Props {
	overlay?: boolean;
}

export function PageLoader({ overlay = false }: Props) {
	const spinner = (
		<div className="relative flex items-center justify-center">
			<div className="absolute h-12 w-12 rounded-full bg-primary/20 blur-2xl" />
			<span className="relative text-4xl font-bold text-primary animate-pulse [animation-duration:1.2s]">
				生
			</span>
		</div>
	);

	if (overlay) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[2px] [animation:loader-appear_0.2s_ease_0.15s_both] opacity-0">
				{spinner}
			</div>
		);
	}

	return (
		<div className="flex min-h-[60vh] items-center justify-center [animation:loader-appear_0.2s_ease_0.1s_both] opacity-0">
			{spinner}
		</div>
	);
}
