import { AddBookModal } from "@/features/tsundoku/components/AddBookModal";
import { Book01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Card, CardContent } from "@seikatsu/ui";

export function BooksEmptyState({ workspaceId }: { workspaceId: string }) {
	return (
		<Card className="border-dashed">
			<CardContent className="flex flex-col items-center gap-4 py-14 text-center">
				<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
					<HugeiconsIcon icon={Book01Icon} className="h-7 w-7" />
				</div>
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">Your shelf is empty</h2>
					<p className="max-w-sm text-sm text-muted-foreground">
						Search Open Library &amp; Google Books, or add a book manually, to start tracking your
						reading.
					</p>
				</div>
				<AddBookModal
					workspaceId={workspaceId}
					trigger={<Button size="lg">Add your first book</Button>}
				/>
			</CardContent>
		</Card>
	);
}
