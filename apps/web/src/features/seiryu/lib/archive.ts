export type ArchivedCardRow = {
	id: string;
	title: string;
	/** YYYY-MM-DD in the user's time zone. */
	archivedOn: string | null;
	projectId: string;
	projectName: string;
	columnName: string;
};

/** Archive timestamps as the user's calendar day, for "archived Oct 5". */
export function toArchivedRows(
	cards: (Omit<ArchivedCardRow, "archivedOn"> & { archivedAt: Date | null })[],
	timeZone: string,
): ArchivedCardRow[] {
	const day = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return cards.map(({ archivedAt, ...card }) => ({
		...card,
		archivedOn: archivedAt ? day.format(archivedAt) : null,
	}));
}
