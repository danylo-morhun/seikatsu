// Books just added from the capture dialog: their tile drops in once when the library shows it.

const fresh = new Set<string>();

export function markFresh(bookId: string) {
	fresh.add(bookId);
}

/** True the first time a fresh book is rendered, then never again. */
export function takeFresh(bookId: string): boolean {
	return fresh.delete(bookId);
}
