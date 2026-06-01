"use client";

import type { getAccounts } from "@/features/kuroji/actions/accounts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@seikatsu/ui";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];

interface Props {
	control: Control<never>;
	name: string;
	accounts: Account[];
	placeholder: string;
	error?: string;
}

export function AccountSelect({ control, name, accounts, placeholder, error }: Props) {
	return (
		<Controller
			control={control as never}
			name={name as never}
			render={({ field }: { field: { onChange: (v: string) => void; value: string } }) => (
				<>
					<Select onValueChange={field.onChange} value={field.value ?? ""}>
						<SelectTrigger>
							<SelectValue placeholder={placeholder} />
						</SelectTrigger>
						<SelectContent>
							{accounts.map((a) => (
								<SelectItem key={a.id} value={a.id}>
									{a.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{error && <p className="text-destructive text-[0.8rem]">{error}</p>}
				</>
			)}
		/>
	);
}
