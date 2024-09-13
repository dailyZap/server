import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
	omit: {
		invite: {
			code: true
		},
		user: {
			otp: true,
			sessionToken: true
		}
	}
});
