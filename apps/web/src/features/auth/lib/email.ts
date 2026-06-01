import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");
const FROM = process.env.AUTH_EMAIL_FROM ?? "seikatsu <noreply@seikatsu.danylomorhun.com>";

export async function sendEmailChangeVerification(to: string, verifyUrl: string) {
	await resend.emails.send({
		from: FROM,
		to,
		subject: "Verify your new email address",
		html: `<p>Click <a href="${verifyUrl}">here</a> to confirm your new email address. Link expires in 24 hours.</p>`,
	});
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
	await resend.emails.send({
		from: FROM,
		to,
		subject: "Reset your seikatsu password",
		html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
	});
}
