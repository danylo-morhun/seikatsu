"use client";

// A native date or time field that saves once it is left, not on every stop of iOS's wheel
// (saving there re-rendered the field and closed the picker). It never carries a value
// attribute: iOS's Reset puts the field back to that attribute, so with none it clears it.

import { Input } from "@seikatsu/ui";
import { type ComponentProps, useEffect, useLayoutEffect, useRef } from "react";

interface Props
	extends Omit<
		ComponentProps<typeof Input>,
		"value" | "defaultValue" | "onChange" | "onBlur" | "pattern"
	> {
	value: string | null;
	/** What a whole value looks like; anything else (half-typed) is not saved. */
	valid: RegExp;
	onCommit: (value: string | null) => void;
}

export function PickerInput({ value, valid, onCommit, onKeyDown, ...rest }: Props) {
	const ref = useRef<HTMLInputElement>(null);
	const draft = useRef(value ?? "");
	const saved = useRef(value);

	useLayoutEffect(() => {
		saved.current = value;
		draft.current = value ?? "";
		if (ref.current) ref.current.value = value ?? "";
	}, [value]);

	const commit = () => {
		const next =
			draft.current === "" ? null : valid.test(draft.current) ? draft.current : saved.current;
		if (next === saved.current) return;
		saved.current = next;
		onCommit(next);
	};
	// Closing the sheet with the picker still open saves what it shows.
	const commitRef = useRef(commit);
	commitRef.current = commit;
	useEffect(() => () => commitRef.current(), []);

	return (
		<Input
			ref={ref}
			{...rest}
			onChange={(e) => {
				draft.current = e.target.value;
			}}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === "Enter") commit();
				onKeyDown?.(e);
			}}
		/>
	);
}
