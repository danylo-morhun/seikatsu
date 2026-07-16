"use client";

import type { KeizokuHabitLog } from "@/features/keizoku/actions/logs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@seikatsu/ui";
import { useState } from "react";

function formatDate(iso: string): string {
	return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function PhotoGallery({ photos }: { photos: KeizokuHabitLog[] }) {
	const [selected, setSelected] = useState<KeizokuHabitLog | null>(null);

	if (photos.length === 0) return null;

	return (
		<div className="space-y-2">
			<h2 className="text-sm font-medium text-muted-foreground">Photos ({photos.length})</h2>
			<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
				{photos.map((log) => (
					<button
						key={log.id}
						type="button"
						onClick={() => setSelected(log)}
						className="aspect-square overflow-hidden rounded-md bg-muted"
						aria-label={`View photo from ${formatDate(log.date)}`}
					>
						<img
							src={log.photoUrl ?? undefined}
							alt=""
							className="h-full w-full object-cover transition-transform hover:scale-105"
						/>
					</button>
				))}
			</div>

			<Dialog open={selected != null} onOpenChange={(v) => !v && setSelected(null)}>
				<DialogContent className="sm:max-w-md">
					{selected && (
						<>
							<DialogHeader>
								<DialogTitle>{formatDate(selected.date)}</DialogTitle>
							</DialogHeader>
							<img
								src={selected.photoUrl ?? undefined}
								alt=""
								className="w-full rounded-lg object-cover"
							/>
							{selected.note && <p className="text-sm text-muted-foreground">{selected.note}</p>}
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
