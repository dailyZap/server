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

export interface AuthProps {
	requestUserId: string;
	assetOwnerId: string;
}

export const isSelf = (auth: AuthProps): boolean => {
	return auth.requestUserId === auth.assetOwnerId;
};

export const hasIncomingFriendRequest = async (auth: AuthProps): Promise<boolean> => {
	const hasIncomingFriendRequest = await prisma.friendRequest.findUnique({
		where: {
			senderId_receiverId: {
				senderId: auth.assetOwnerId,
				receiverId: auth.requestUserId
			}
		}
	});
	return Boolean(hasIncomingFriendRequest);
};

export const isFriend = async (auth: AuthProps): Promise<boolean> => {
	const isFriend = await prisma.user.findFirst({
		where: {
			id: auth.assetOwnerId,
			OR: [
				{
					friendsOf: {
						some: {
							senderId: auth.requestUserId
						}
					}
				},
				{
					friendsWith: {
						some: {
							receiverId: auth.requestUserId
						}
					}
				}
			]
		}
	});
	return Boolean(isFriend);
};

export const isFriendOfFriend = async (auth: AuthProps): Promise<boolean> => {
	const isFriendOfFriend = await prisma.user.findFirst({
		where: {
			id: auth.assetOwnerId,
			OR: [
				{
					friendsOf: {
						some: {
							sender: {
								OR: [
									{
										friendsOf: {
											some: {
												senderId: auth.requestUserId
											}
										}
									},
									{
										friendsWith: {
											some: {
												receiverId: auth.requestUserId
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
												senderId: auth.requestUserId
											}
										}
									},
									{
										friendsWith: {
											some: {
												receiverId: auth.requestUserId
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
	return Boolean(isFriendOfFriend);
};

export async function userHasPermissionsForProfilePicture(auth: AuthProps): Promise<boolean> {
	if (isSelf(auth)) return true;

	if (await hasIncomingFriendRequest(auth)) return true;

	if (await isFriend(auth)) return true;

	if (await isFriendOfFriend(auth)) return true;

	return false;
}

export async function userHasPermissionsForZapImage(auth: AuthProps): Promise<boolean> {
	if (isSelf(auth)) return true;

	if (await isFriend(auth)) return true;

	return false;
}
