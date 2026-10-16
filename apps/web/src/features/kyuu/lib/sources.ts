// One spelling per job board. Keep in step with SOURCE_NAMES in the job-search pipeline
// (../job-search/scraper/lib/kyuu-sync.js), which writes most rows.

const SOURCE_NAMES: Record<string, string> = {
	djinni: "Djinni",
	dou: "DOU",
	"dou.ua": "DOU",
	linkedin: "LinkedIn",
	justjoin: "JustJoin",
	"justjoin.it": "JustJoin",
	nofluffjobs: "NoFluffJobs",
	arbeitnow: "Arbeitnow",
	germantechjobs: "GermanTechJobs",
	swissdevjobs: "SwissDevJobs",
	devjobsat: "devjobs.at",
	"devjobs.at": "devjobs.at",
	remoteok: "RemoteOK",
	remotive: "Remotive",
	himalayas: "Himalayas",
	workingnomads: "Working Nomads",
	weworkremotely: "We Work Remotely",
	berlinstartupjobs: "Berlin Startup Jobs",
	builtin: "BuiltIn",
	epam: "EPAM Careers",
	greenhouse: "Greenhouse",
	lever: "Lever",
	ashby: "Ashby",
	personio: "Personio",
	recruitee: "Recruitee",
	workable: "Workable",
	smartrecruiters: "SmartRecruiters",
};

/** A board's display name; anything unknown is kept as typed. Blank is no source. */
export function normalizeSource(source: string | null | undefined): string | null {
	const trimmed = source?.trim();
	if (!trimmed) return null;
	return SOURCE_NAMES[trimmed.toLowerCase()] ?? trimmed;
}
