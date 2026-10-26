-- One spelling per board: rows the pipeline wrote before it normalized sources ("djinni",
-- "dou") get the name normalizeSource gives (lib/sources.ts). Others stay as typed.
UPDATE "kyuu_applications" AS a
SET "source" = n.name
FROM (VALUES
	('djinni', 'Djinni'),
	('dou', 'DOU'),
	('dou.ua', 'DOU'),
	('linkedin', 'LinkedIn'),
	('justjoin', 'JustJoin'),
	('justjoin.it', 'JustJoin'),
	('nofluffjobs', 'NoFluffJobs'),
	('arbeitnow', 'Arbeitnow'),
	('germantechjobs', 'GermanTechJobs'),
	('swissdevjobs', 'SwissDevJobs'),
	('devjobsat', 'devjobs.at'),
	('devjobs.at', 'devjobs.at'),
	('remoteok', 'RemoteOK'),
	('remotive', 'Remotive'),
	('himalayas', 'Himalayas'),
	('workingnomads', 'Working Nomads'),
	('weworkremotely', 'We Work Remotely'),
	('berlinstartupjobs', 'Berlin Startup Jobs'),
	('builtin', 'BuiltIn'),
	('epam', 'EPAM Careers'),
	('greenhouse', 'Greenhouse'),
	('lever', 'Lever'),
	('ashby', 'Ashby'),
	('personio', 'Personio'),
	('recruitee', 'Recruitee'),
	('workable', 'Workable'),
	('smartrecruiters', 'SmartRecruiters')
) AS n(key, name)
WHERE lower(trim(a."source")) = n.key AND a."source" <> n.name;
