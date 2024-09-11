import { createTransport } from "nodemailer";

export const mailer = createTransport({
	host: process.env.MAIL_HOST,
	port: parseInt(process.env.MAIL_PORT ?? "587"),
	secure: process.env.MAIL_SECURE === "true",
	auth:
		process.env.MAIL_SECURE === "true"
			? {
					user: process.env.MAIL_USER,
					pass: process.env.MAIL_PASS
				}
			: undefined
});
