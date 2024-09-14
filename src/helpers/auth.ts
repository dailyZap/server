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

export interface AccessRequest {
	requestUserId: string;
	assetId: string;
}

export interface AccessRequestWithOwner extends AccessRequest {
	assetOwnerId: string;
}

export const isSelf = (auth: AccessRequestWithOwner): boolean => {
	return auth.requestUserId === auth.assetOwnerId;
};

export const hasIncomingFriendRequest = async (auth: AccessRequestWithOwner): Promise<boolean> => {
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

export const isFriend = async (auth: AccessRequestWithOwner): Promise<boolean> => {
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

export const isFriendOfFriend = async (auth: AccessRequestWithOwner): Promise<boolean> => {
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

export async function userHasPermissionsForProfilePicture(
	request: AccessRequest
): Promise<boolean> {
	const requestWOwner = {
		requestUserId: request.requestUserId,
		assetId: request.assetId,
		assetOwnerId: request.assetId
	};

	if (isSelf(requestWOwner)) return true;

	if (await hasIncomingFriendRequest(requestWOwner)) return true;

	if (await isFriend(requestWOwner)) return true;

	if (await isFriendOfFriend(requestWOwner)) return true;

	return false;
}

export async function userHasPermissionsForZapImage(request: AccessRequest): Promise<boolean> {
	const asset = await prisma.zap.findUniqueOrThrow({
		where: {
			id: request.assetId
		}
	});

	const requestWOwner = {
		requestUserId: request.requestUserId,
		assetId: request.assetId,
		assetOwnerId: asset.authorId
	};

	if (isSelf(requestWOwner)) return true;

	if (await isFriend(requestWOwner)) return true;

	return false;
}

export async function userHasPermissionsForReactionImage(request: AccessRequest): Promise<boolean> {
	const asset = await prisma.reaction.findUniqueOrThrow({
		where: {
			id: request.assetId
		}
	});

	const requestWOwner = {
		requestUserId: request.requestUserId,
		assetId: request.assetId,
		assetOwnerId: asset.authorId
	};

	if (isSelf(requestWOwner)) return true;

	if (
		await userHasPermissionsForZapImage({
			requestUserId: request.requestUserId,
			assetId: asset.zapId
		})
	)
		return true;

	return false;
}
