// Sealing secrets kept in the database (a connected Google account's tokens): AES-256-GCM with a
// key derived from AUTH_SECRET, so a copy of the database alone doesn't hand them out.
// Server-only.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
	const secret = process.env.AUTH_SECRET;
	if (!secret) throw new Error("AUTH_SECRET is not set");
	return createHash("sha256").update(`seikatsu:seal:${secret}`).digest();
}

/** "v1.<iv>.<tag>.<data>", base64url. */
export function seal(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key(), iv);
	const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return ["v1", iv, cipher.getAuthTag(), data]
		.map((p) => (typeof p === "string" ? p : p.toString("base64url")))
		.join(".");
}

export function unseal(sealed: string): string {
	const [v, iv, tag, data] = sealed.split(".");
	if (v !== "v1" || !iv || !tag || !data) throw new Error("Not a sealed value");
	const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
	decipher.setAuthTag(Buffer.from(tag, "base64url"));
	return Buffer.concat([
		decipher.update(Buffer.from(data, "base64url")),
		decipher.final(),
	]).toString("utf8");
}
