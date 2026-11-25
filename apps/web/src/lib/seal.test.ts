import { beforeAll, describe, expect, it } from "vitest";
import { seal, unseal } from "./seal";

beforeAll(() => {
	process.env.AUTH_SECRET ??= "test-secret";
});

describe("seal", () => {
	it("round-trips and never repeats", () => {
		const a = seal("1//refresh-token");
		expect(unseal(a)).toBe("1//refresh-token");
		expect(seal("1//refresh-token")).not.toBe(a);
	});
	it("refuses a tampered value", () => {
		const [v, iv, tag, data] = seal("token").split(".");
		const flipped = `${data?.[0] === "A" ? "B" : "A"}${data?.slice(1)}`;
		expect(() => unseal([v, iv, tag, flipped].join("."))).toThrow();
	});
});
