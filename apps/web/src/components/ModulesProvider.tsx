"use client";

import { createContext, useContext } from "react";
import { MODULE_HREFS, type ModuleHref } from "@/lib/modules";

const ModulesContext = createContext<readonly ModuleHref[]>(MODULE_HREFS);

/** The modules the user has on (lib/modules.ts), for the shell's client parts. */
export function ModulesProvider({
	on,
	children,
}: {
	on: readonly ModuleHref[];
	children: React.ReactNode;
}) {
	return <ModulesContext.Provider value={on}>{children}</ModulesContext.Provider>;
}

export const useModules = () => useContext(ModulesContext);
