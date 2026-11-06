"use client";

import { Checkbox } from "@seikatsu/ui";
import { Button } from "@seikatsu/ui/button";
import { Card, CardContent } from "@seikatsu/ui/card";
import { Label } from "@seikatsu/ui/label";
import Image from "next/image";
import { useState } from "react";
import { Spinner } from "@/components/Spinner";
import { answerConsent } from "@/features/mcp/actions/consent";
import type { AuthorizeParams } from "@/features/mcp/lib/authorize";

export function ConsentCard({
	params,
	clientName,
	redirectHost,
	offersWrite,
	who,
}: {
	params: AuthorizeParams;
	clientName: string;
	redirectHost: string;
	offersWrite: boolean;
	who: string;
}) {
	const [write, setWrite] = useState(offersWrite);
	const [pending, setPending] = useState<"allow" | "deny" | null>(null);

	return (
		<Card className="ring-border/60 w-full max-w-md ring-1">
			<CardContent className="space-y-5 p-8">
				<div className="flex flex-col items-center gap-3 text-center">
					<Image src="/icons/favicon.svg" alt="seikatsu" width={44} height={44} />
					<h1 className="text-lg font-semibold tracking-tight">Connect {clientName}</h1>
					<p className="text-muted-foreground text-sm">
						<span className="text-foreground">{clientName}</span> ({redirectHost}) wants to use your
						seikatsu{who ? ` as ${who}` : ""}.
					</p>
				</div>
				<ul className="inset-group text-sm">
					<li className="px-(--group-px) py-3">
						<p className="font-medium">Read everything</p>
						<p className="text-muted-foreground text-xs">
							Today, Week, Goals and every app: money, cards, jobs, books, habits, car, wants.
						</p>
					</li>
					{offersWrite && (
						<li className="flex items-start gap-3 px-(--group-px) py-3">
							<Checkbox
								id="consent-write"
								checked={write}
								onCheckedChange={(v) => setWrite(v === true)}
								className="mt-0.5"
							/>
							<Label htmlFor="consent-write" className="block cursor-pointer font-normal">
								<span className="block font-medium">Make changes</span>
								<span className="text-muted-foreground block text-xs">
									Add transactions, cards, wants; tick habits; log reading, mileage, follow-ups.
									Never deletes.
								</span>
							</Label>
						</li>
					)}
				</ul>
				<form
					action={answerConsent}
					onSubmit={(e) => {
						const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
						setPending(submitter?.value === "deny" ? "deny" : "allow");
					}}
					className="grid grid-cols-2 gap-3"
				>
					{Object.entries(params).map(([k, v]) => (
						<input key={k} type="hidden" name={k} value={v} />
					))}
					{write && <input type="hidden" name="write" value="on" />}
					<Button
						type="submit"
						name="decision"
						value="deny"
						variant="outline"
						disabled={pending !== null}
						className="gap-1.5"
					>
						{pending === "deny" && <Spinner />}
						Deny
					</Button>
					<Button
						type="submit"
						name="decision"
						value="allow"
						disabled={pending !== null}
						className="gap-1.5"
					>
						{pending === "allow" && <Spinner />}
						{pending === "allow" ? "Connecting…" : "Allow"}
					</Button>
				</form>
				<p className="text-muted-foreground text-center text-xs">
					You can disconnect it any time in Settings → Account → Claude.
				</p>
			</CardContent>
		</Card>
	);
}
