import type { Op, OpName } from "@/features/pwa/lib/ops";
import { describe, expect, it, vi } from "vitest";

// The patches are pure; the server actions beside them never run here.
vi.mock("../actions/progress", () => ({}));
const { queuedPatches } = await import("./offline");

let n = 0;
function op<N extends OpName>(name: N, args: Op<N>["args"]): Op {
	return { opId: `op${n++}`, name, args, label: "", createdAt: n, status: "pending" } as Op;
}

describe("queuedPatches", () => {
	it("folds queued status, follow-up and archive into one patch per application", () => {
		expect(
			queuedPatches([
				op("kyuu.setStatus", { applicationId: "a", status: "technical_interview" }),
				op("kyuu.followUp", { applicationId: "b", id: "e", date: "2026-10-26" }),
				op("kyuu.setArchived", { applicationId: "b", archived: true }),
			]),
		).toEqual({
			a: { status: "technical_interview", waiting: null },
			b: { waiting: null, hidden: true },
		});
	});
});
