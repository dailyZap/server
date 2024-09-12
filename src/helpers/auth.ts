import { User } from "@prisma/client";
import { Request } from "express";
import { prisma } from "./db";
import { UnauthorizedError } from "./error";

const prefix = "bearer ";

export interface RequestWithUser extends Request {
	user: {
		user: User;
	};
}

export async function expressAuthentication(request: Request): Promise<RequestWithUser["user"]> {
	let token;
	if (request.headers && request.headers.authorization) {
		token = request.headers.authorization;
	}

	if (!token || !token.toLowerCase().startsWith(prefix))
		return Promise.reject(new UnauthorizedError());
	token = token.slice(prefix.length);

	const user = await prisma.user.findUnique({
		where: {
			sessionToken: token
		}
	});

	if (!user) return Promise.reject(new UnauthorizedError());

	return Promise.resolve({ user });
}
