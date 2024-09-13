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

export async function hasPermissionsForProfilePicture(
	requestUserId: string,
	responseUserId: string
): Promise<boolean> {
	const isSelf = requestUserId === responseUserId;
	if (isSelf) return true;

	const hasIncomingFriendRequest = await prisma.friendRequest.findUnique({
		where: {
			senderId_receiverId: {
				senderId: responseUserId,
				receiverId: requestUserId
			}
		}
	});
	if (hasIncomingFriendRequest) return true;

	const isFriend = await prisma.user.findFirst({
		where: {
			id: responseUserId,
			OR: [
				{
					friendsOf: {
						some: {
							senderId: requestUserId
						}
					}
				},
				{
					friendsWith: {
						some: {
							receiverId: requestUserId
						}
					}
				}
			]
		}
	});
	if (isFriend) return true;

	const isFriendOfFriend = await prisma.user.findFirst({
		where: {
			id: responseUserId,
			OR: [
				{
					friendsOf: {
						some: {
							sender: {
								OR: [
									{
										friendsOf: {
											some: {
												senderId: requestUserId
											}
										}
									},
									{
										friendsWith: {
											some: {
												receiverId: requestUserId
											}
										}
									}
								]
							}
						}
					}
				},
				{
					friendsWith: {
						some: {
							receiver: {
								OR: [
									{
										friendsOf: {
											some: {
												senderId: requestUserId
											}
										}
									},
									{
										friendsWith: {
											some: {
												receiverId: requestUserId
											}
										}
									}
								]
							}
						}
					}
				}
			]
		}
	});
	if (isFriendOfFriend) return true;

	return false;
}
