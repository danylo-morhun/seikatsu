"use client";

import {
	Checkbox,
	cn,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useId, useState } from "react";
import { QuietAdd } from "@/components/QuietAdd";
import { ChecklistSection } from "@/features/seiryu/components/ChecklistSection";
import { DueDateChip } from "@/features/seiryu/components/DueDateChip";
import { LabelPicker } from "@/features/seiryu/components/LabelPicker";
import { PriorityBadge } from "@/features/seiryu/components/PriorityBadge";
import { PRIORITIES, PRIORITY_CONFIG, type Priority } from "@/features/seiryu/lib/constants";
import { DAY_START, type Due, nextDue, REMIND_OPTIONS, TIME } from "@/features/seiryu/lib/reminder";
import { REPEAT_PRESETS, type RepeatUnit, repeatLabel } from "@/features/seiryu/lib/repeat";
import type { CardData, CardFieldUpdates, LabelData } from "@/features/seiryu/lib/types";
import { useDraft } from "@/hooks/useDraft";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const FIELD_TEXTAREA =
	"w-full resize-none rounded-field border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-colors [field-sizing:content] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

interface Props {
	card: CardData;
	columns: { id: string; name: string }[];
	projectLabels: LabelData[];
	/** Saves only the fields that changed; the caller applies them at once and persists. */
	onSave: (updates: CardFieldUpdates) => void;
	onMove: (columnId: string) => void;
	/** Mirrors checklist and label edits, which persist themselves. */
	onChange: (updates: Partial<CardData>) => void;
	onProjectLabelsChange?: (labels: LabelData[]) => void;
	/** The title is the page's heading on the full page, the sheet's on the board. */
	titleId?: string;
	readOnly?: boolean;
	/** The description is still on its way (the board loads it when the card opens). */
	descriptionLoading?: boolean;
	/** The user's calendar day (tz cookie), as on the board. */
	today: string;
}

/**
 * Everything about one card, shared by the sheet and the full page. Every field saves
 * itself — text on blur, Enter or close; pickers on change — so nothing is ever lost and
 * one edit never overwrites another field with a stale value.
 */
export function CardDetail({
	card,
	columns,
	projectLabels,
	onSave,
	onMove,
	onChange,
	onProjectLabelsChange,
	titleId,
	readOnly = false,
	descriptionLoading = false,
	today,
}: Props) {
	const id = useId();
	const [writingNotes, setWritingNotes] = useState(false);

	const title = useDraft(card.title, (next) => {
		const trimmed = next.trim();
		if (trimmed && trimmed !== card.title) onSave({ title: trimmed });
		else title.revert();
	});
	// The presets, plus the card's own rule when it's another (set through Claude, say).
	const repeatValue = card.repeatUnit ? `${card.repeatEvery}-${card.repeatUnit}` : "none";
	const repeatChoices =
		card.repeatUnit &&
		card.repeatEvery &&
		!REPEAT_PRESETS.some((r) => `${r.every}-${r.unit}` === repeatValue)
			? [...REPEAT_PRESETS, { every: card.repeatEvery, unit: card.repeatUnit }]
			: REPEAT_PRESETS;

	// Date, time and reminder hang together (no date: no time), so they save as one.
	const saveDue = (edit: Partial<Due>) => onSave(nextDue(card, edit));
	const description = useDraft(card.description ?? "", (next) => {
		const value = next.trim() ? next : null;
		if (value !== card.description) onSave({ description: value });
	});

	return (
		<div className="space-y-8">
			<div className="space-y-5">
				<textarea
					id={titleId}
					aria-label="Title"
					value={title.draft}
					rows={1}
					maxLength={500}
					readOnly={readOnly}
					onChange={(e) => title.change(e.target.value)}
					onBlur={title.flush}
					onKeyDown={(e) => {
						// A title is one line: Enter commits instead of breaking it.
						if (e.key === "Enter") {
							e.preventDefault();
							e.currentTarget.blur();
						}
					}}
					className="-mx-2 block w-[calc(100%+1rem)] resize-none rounded-md bg-transparent px-2 py-1 text-lg leading-snug font-semibold tracking-tight break-words outline-none transition-colors duration-150 [field-sizing:content] hover:bg-surface focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring"
				/>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor={`${id}-column`}>Column</Label>
						<Select value={card.columnId} onValueChange={onMove} disabled={readOnly}>
							<SelectTrigger id={`${id}-column`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{columns.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${id}-priority`}>Priority</Label>
						<Select
							value={card.priority ?? "none"}
							disabled={readOnly}
							onValueChange={(v) => {
								const priority = v === "none" ? null : (v as Priority);
								if (priority !== card.priority) onSave({ priority });
							}}
						>
							<SelectTrigger id={`${id}-priority`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No priority</SelectItem>
								{PRIORITIES.map((p) => (
									<SelectItem key={p} value={p}>
										<PriorityBadge priority={p} className="mr-1.5" />
										{PRIORITY_CONFIG[p].label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<div className="flex items-baseline justify-between gap-2">
							<Label htmlFor={`${id}-due`}>Due</Label>
							{/* The tile's wording beside the browser's own date format. */}
							{card.dueDate && (
								<DueDateChip dueDate={card.dueDate} dueTime={card.dueTime} today={today} />
							)}
						</div>
						<div className="flex gap-2">
							<Input
								id={`${id}-due`}
								type="date"
								aria-label="Due date"
								readOnly={readOnly}
								className="min-w-0 flex-[3]"
								// Uncontrolled while typing: a half-typed date reads as "" and must not clear it.
								key={card.dueDate ?? "none"}
								defaultValue={card.dueDate ?? ""}
								onChange={(e) => {
									const value = e.target.value;
									if (DATE.test(value) && value !== card.dueDate) saveDue({ dueDate: value });
								}}
								onBlur={(e) => {
									if (!e.target.value && card.dueDate) saveDue({ dueDate: null });
								}}
							/>
							<Input
								type="time"
								aria-label="Due time"
								readOnly={readOnly}
								disabled={!card.dueDate}
								className="min-w-0 flex-[2]"
								key={`${card.dueDate ?? "none"}-${card.dueTime ?? "any"}`}
								defaultValue={card.dueTime ?? ""}
								onChange={(e) => {
									const value = e.target.value;
									if (TIME.test(value) && value !== card.dueTime) saveDue({ dueTime: value });
								}}
								onBlur={(e) => {
									if (!e.target.value && card.dueTime) saveDue({ dueTime: null });
								}}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${id}-remind`}>Remind</Label>
						<Select
							value={card.remindMinutes == null ? "none" : String(card.remindMinutes)}
							disabled={readOnly || !card.dueDate}
							onValueChange={(v) => {
								const remindMinutes = v === "none" ? null : Number(v);
								if (remindMinutes !== card.remindMinutes) saveDue({ remindMinutes });
							}}
						>
							<SelectTrigger id={`${id}-remind`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">
									{card.dueDate ? "No reminder" : "Set a date first"}
								</SelectItem>
								{REMIND_OPTIONS.map((o) => (
									<SelectItem key={o.minutes} value={String(o.minutes)}>
										{o.minutes === 0 && !card.dueTime ? `At ${DAY_START}` : o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${id}-repeat`}>Repeat</Label>
						<Select
							value={repeatValue}
							disabled={readOnly}
							onValueChange={(v) => {
								if (v === repeatValue) return;
								if (v === "none") return onSave({ repeatEvery: null, repeatUnit: null });
								const [every, unit] = v.split("-") as [string, RepeatUnit];
								onSave({ repeatEvery: Number(every), repeatUnit: unit });
							}}
						>
							<SelectTrigger id={`${id}-repeat`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Doesn't repeat</SelectItem>
								{repeatChoices.map((r) => (
									<SelectItem key={`${r.every}-${r.unit}`} value={`${r.every}-${r.unit}`}>
										{repeatLabel(r.every, r.unit)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{card.repeatUnit && (
						<div className="flex items-center gap-2 self-end pb-2">
							<Checkbox
								id={`${id}-from-done`}
								checked={card.repeatFromDone}
								disabled={readOnly}
								onCheckedChange={(checked) => onSave({ repeatFromDone: checked === true })}
							/>
							<Label htmlFor={`${id}-from-done`} className="font-normal">
								Count from the day it's done
							</Label>
						</div>
					)}
				</div>

				{!description.draft && !writingNotes && !descriptionLoading ? (
					!readOnly && <QuietAdd onClick={() => setWritingNotes(true)}>Add notes</QuietAdd>
				) : (
					<div className="animate-swap space-y-2">
						<Label htmlFor={`${id}-description`}>Description</Label>
						<textarea
							id={`${id}-description`}
							value={description.draft}
							readOnly={readOnly || descriptionLoading}
							aria-busy={descriptionLoading || undefined}
							maxLength={5000}
							onChange={(e) => description.change(e.target.value)}
							autoFocus={writingNotes && !card.description}
							// Emptying it while typing keeps the field; leaving it empty folds it away.
							onFocus={() => setWritingNotes(true)}
							onBlur={() => {
								description.flush();
								setWritingNotes(false);
							}}
							placeholder={descriptionLoading ? "Loading…" : "Notes, links, what done looks like…"}
							className={cn(FIELD_TEXTAREA, "min-h-24")}
						/>
					</div>
				)}
			</div>

			{!readOnly && (
				<>
					<LabelPicker
						cardId={card.id}
						projectId={card.projectId}
						projectLabels={projectLabels}
						cardLabels={card.labels}
						onChange={(labels) => onChange({ labels })}
						onProjectLabelsChange={onProjectLabelsChange}
					/>
					<ChecklistSection
						cardId={card.id}
						initialItems={card.checklistItems}
						onChange={(checklistItems) => onChange({ checklistItems })}
					/>
				</>
			)}
		</div>
	);
}
