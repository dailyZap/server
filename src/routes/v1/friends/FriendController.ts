import { typeid } from "typeid-js";
import { RequestWithUser } from "../../../helpers/auth";
import { prisma } from "../../../helpers/db";
import { Prefix } from "../../../enums/Prefix";
import { sendNotifications } from "../../../libs/push-gateway";
import {
	Controller,
	Path,
	Put,
	Route,
	Security,
	Tags,
	Request,
	Get,
	Delete,
	Res,
	TsoaResponse
} from "tsoa";
import { UserProps } from "../../../models/UserProps";
import { storage } from "../../../helpers/storage";
import { Buckets } from "../../../enums/Buckets";

interface FriendsResponseProps {
	friends: UserProps[];
}

interface FriendRequestsResponseProps {
	incoming: UserProps[];
	outgoing: UserProps[];
}

@Tags("Friends")
@Route("v1/friends")
@Security("sessionToken")
export class FriendController extends Controller {
	@Put("requests/{handle}")
	public async requestFriendship(
		@Request() request: RequestWithUser,
		@Path() handle: string,
		@Res() forbidden: TsoaResponse<403, { reason: string }>
	): Promise<void> {
		const receiver = await prisma.user.findUniqueOrThrow({
			where: {
				handle
			}
		});

		if (receiver.id === request.user.user.id) {
			return forbidden(403, { reason: "You cannot send a friend request to yourself" });
		}

		const existingFriendRequest = await prisma.friendRequest.findUnique({
			where: {
				senderId_receiverId: {
					senderId: receiver.id,
					receiverId: request.user.user.id
				}
			}
		});

		if (existingFriendRequest) {
			await prisma.friendRequest.delete({
				where: {
					senderId_receiverId: {
						senderId: receiver.id,
						receiverId: request.user.user.id
					}
				}
			});

			await prisma.friendship.create({
				data: {
					id: typeid(Prefix.FRIENDSHIP).toString(),
					senderId: receiver.id,
					receiverId: request.user.user.id
				}
			});

			return;
		}

		await prisma.friendRequest.create({
			data: {
				id: typeid(Prefix.FRIEND_REQUEST).toString(),
				senderId: request.user.user.id,
				receiverId: receiver.id
			}
		});

		if (receiver.deviceToken === null) return;

		const notification = await prisma.notification.create({
			data: {
				id: typeid(Prefix.NOTIFICATION).toString(),
				type: "FRIEND_REQUEST",
				title: "Friend Request",
				content: `${request.user.user.handle} has sent you a friend request!`,
				userId: receiver.id,
				targetId: request.user.user.id
			}
		});

		await sendNotifications({
			body: {
				notifications: [
					{
						notificationId: notification.id,
						deviceToken: receiver.deviceToken
					}
				]
			}
		});
	}

	@Delete("requests/{handle}")
	public async deleteFriendRequest(
		@Request() request: RequestWithUser,
		@Path() handle: string
	): Promise<void> {
		const receiver = await prisma.user.findUniqueOrThrow({
			where: {
				handle
			}
		});

		await prisma.friendRequest.delete({
			where: {
				senderId_receiverId: {
					senderId: request.user.user.id,
					receiverId: receiver.id
				}
			}
		});

		if (receiver.deviceToken == null) return;

		await prisma.notification.deleteMany({
			where: {
				targetId: request.user.user.id,
				userId: receiver.id,
				type: "FRIEND_REQUEST"
			}
		});
	}

	@Put("accept/{senderId}")
	public async acceptFriendship(
		@Request() request: RequestWithUser,
		@Path() senderId: string
	): Promise<void> {
		const friendRequest = await prisma.friendRequest.findUniqueOrThrow({
			where: {
				senderId_receiverId: {
					senderId: senderId,
					receiverId: request.user.user.id
				}
			}
		});

		if (friendRequest.receiverId !== request.user.user.id) {
			throw new Error("You are not the receiver of this friend request");
		}

		await prisma.friendRequest.delete({
			where: {
				senderId_receiverId: {
					senderId: senderId,
					receiverId: request.user.user.id
				}
			}
		});

		await prisma.friendship.create({
			data: {
				id: typeid(Prefix.FRIENDSHIP).toString(),
				senderId: friendRequest.senderId,
				receiverId: friendRequest.receiverId
			}
		});
	}

	@Put("reject/{senderId}")
	public async rejectFriendship(
		@Request() request: RequestWithUser,
		@Path() senderId: string
	): Promise<void> {
		const friendRequest = await prisma.friendRequest.findUniqueOrThrow({
			where: {
				senderId_receiverId: {
					senderId: senderId,
					receiverId: request.user.user.id
				}
			}
		});

		if (friendRequest.receiverId !== request.user.user.id) {
			throw new Error("You are not the receiver of this friend request");
		}

		await prisma.friendRequest.delete({
			where: {
				senderId_receiverId: {
					senderId: senderId,
					receiverId: request.user.user.id
				}
			}
		});
	}

	@Get()
	public async getFriends(@Request() request: RequestWithUser): Promise<FriendsResponseProps> {
		const friendshipIds = await prisma.friendship.findMany({
			where: {
				OR: [
					{
						senderId: request.user.user.id
					},
					{
						receiverId: request.user.user.id
					}
				]
			}
		});

		const friendIds = friendshipIds.map((friendship) => {
			if (friendship.senderId === request.user.user.id) {
				return friendship.receiverId;
			} else {
				return friendship.senderId;
			}
		});

		const friends = await prisma.user.findMany({
			where: {
				id: {
					in: friendIds
				}
			}
		});

		return {
			friends: await Promise.all(
				friends.map(async (friend) => {
					return {
						id: friend.id,
						handle: friend.handle,
						firstName: friend.firstName,
						lastName: friend.lastName,
						profilePictureUrl: await storage.presignedGetObject(
							Buckets.AVATARS,
							`${friend.id}.jpg`,
							15 * 60
						)
					};
				})
			)
		};
	}

	@Get("requests")
	public async getFriendRequests(
		@Request() request: RequestWithUser
	): Promise<FriendRequestsResponseProps> {
		const friendRequests = await prisma.friendRequest.findMany({
			where: {
				OR: [
					{
						senderId: request.user.user.id
					},
					{
						receiverId: request.user.user.id
					}
				]
			}
		});

		const incommingIds = friendRequests
			.filter((friendRequest) => friendRequest.receiverId === request.user.user.id)
			.map((friendRequest) => friendRequest.senderId);
		const outgoingIds = friendRequests
			.filter((friendRequest) => friendRequest.senderId === request.user.user.id)
			.map((friendRequest) => friendRequest.receiverId);

		const potentialFriends = await prisma.user.findMany({
			where: {
				OR: [
					{
						id: {
							in: incommingIds
						}
					},
					{
						id: {
							in: outgoingIds
						}
					}
				]
			}
		});

		const incommingPotentialFriends = potentialFriends.filter((potentialFriend) =>
			incommingIds.includes(potentialFriend.id)
		);
		const outgoingPotentialFriends = potentialFriends.filter((potentialFriend) =>
			outgoingIds.includes(potentialFriend.id)
		);

		return {
			incoming: await Promise.all(
				incommingPotentialFriends.map(async (sender) => {
					return {
						id: sender.id,
						handle: sender.handle,
						firstName: sender.firstName,
						lastName: sender.lastName,
						profilePictureUrl: await storage.presignedGetObject(
							Buckets.AVATARS,
							`${sender.id}.jpg`,
							15 * 60
						)
					};
				})
			),
			outgoing: await Promise.all(
				outgoingPotentialFriends.map(async (receiver) => {
					return {
						id: receiver.id,
						handle: receiver.handle,
						firstName: receiver.firstName,
						lastName: receiver.lastName,
						profilePictureUrl: await storage.presignedGetObject(
							Buckets.AVATARS,
							`${receiver.id}.jpg`,
							15 * 60
						)
					};
				})
			)
		};
	}
}
