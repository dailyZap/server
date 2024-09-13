import { Controller, Get, Route, Security, Tags, Request } from "tsoa";
import { prisma } from "../../../helpers/db";
import { extractTimeFromTypeIdAsNumber } from "../../../helpers/time";
import {
	getPresignedReactionUrl,
	getPresignedZapUrl,
	getProfilePictureUrl
} from "../../../helpers/storage";
import { ReactionType } from "../../../enums/ReactionType";
import { ZapImageType } from "../../../enums/ZapImageType";
import { RequestWithUser } from "../../../helpers/auth";
import { Prefix } from "../../../enums/Prefix";
import { lateTime } from "../../../const/lateTime";

interface Author {
	id: string;
	handle: string;
	firstName: string;
	lastName: string;
	profilePictureUrl: string;
}

interface Comment {
	id: string;
	authorId: string;
	content: string;
	/**
	 * @isInt
	 */
	timestamp: number;
}

interface Reaction {
	id: string;
	authorId: string;
	type: ReactionType;
	imageUrl: string;
	/**
	 * @isInt
	 */
	timestamp: number;
}

interface Zap {
	id: string;
	frontCameraUrl: string;
	backCameraUrl: string;
	/**
	 * @isInt
	 */
	timestamp: number;
	/**
	 * @isInt
	 */
	lateBy?: number;
	comments: Comment[];
	reactions: Reaction[];
}

interface Content {
	userId: string;
	zaps: Zap[];
}

interface FeedResponseProps {
	myZaps: Zap[];
	friend: {
		content: Content[];
		users: Author[];
	};
}

@Tags("Feed")
@Route("v1/feed")
@Security("sessionToken")
export class FeedController extends Controller {
	@Get()
	public async getFeed(@Request() request: RequestWithUser): Promise<FeedResponseProps> {
		const now = new Date();
		const currentMoment = await prisma.moment.findFirstOrThrow({
			where: {
				timestamp: {
					lt: now
				}
			},
			orderBy: {
				timestamp: "desc"
			}
		});

		const content = await prisma.user.findMany({
			where: {
				zaps: {
					some: {
						momentId: currentMoment.id
					}
				},
				OR: [
					{
						friendsWith: {
							some: {
								receiverId: request.user.user.id
							}
						}
					},
					{
						friendsOf: {
							some: {
								senderId: request.user.user.id
							}
						}
					},
					{
						id: request.user.user.id
					}
				]
			},
			select: {
				id: true,
				zaps: {
					where: {
						momentId: currentMoment.id,
						uploaded: true
					},
					include: {
						comments: true,
						reactions: {
							where: {
								image: {
									uploaded: true
								}
							}
						}
					}
				}
			}
		});

		async function returnZapsWithReactionsAndComments(
			userId: string,
			zaps: (typeof content)[0]["zaps"]
		) {
			return await Promise.all(
				zaps.map(async (zap) => {
					const lateBy =
						extractTimeFromTypeIdAsNumber(zap.id, Prefix.ZAP) -
						(currentMoment.timestamp.getTime() + lateTime);
					return {
						id: zap.id,
						frontCameraUrl: await getPresignedZapUrl({
							momentId: currentMoment.id,
							userId: userId,
							zapId: zap.id,
							type: ZapImageType.FRONT
						}),
						backCameraUrl: await getPresignedZapUrl({
							momentId: currentMoment.id,
							userId: userId,
							zapId: zap.id,
							type: ZapImageType.BACK
						}),
						timestamp: extractTimeFromTypeIdAsNumber(zap.id, Prefix.ZAP),
						lateBy: lateBy > 0 ? lateBy : undefined,
						comments: zap.comments.map((comment) => ({
							id: comment.id,
							authorId: comment.authorId,
							content: comment.content,
							timestamp: extractTimeFromTypeIdAsNumber(comment.id, Prefix.COMMENT)
						})),
						reactions: await Promise.all(
							zap.reactions.map(async (reaction) => ({
								id: reaction.id,
								authorId: reaction.authorId,
								type: ReactionType[reaction.type],
								imageUrl: await getPresignedReactionUrl({
									authorId: reaction.authorId,
									reactionType: ReactionType[reaction.type],
									reactionImageId: reaction.imageId
								}),
								timestamp: extractTimeFromTypeIdAsNumber(reaction.id, Prefix.REACTION)
							}))
						)
					};
				})
			);
		}

		const myContentIndex = content.findIndex((user) => user.id === request.user.user.id);

		const myZaps = myContentIndex == -1 ? [] : content[myContentIndex].zaps;
		content.splice(myContentIndex, 1);

		const authorIds = new Set<string>();

		for (const user of content) {
			authorIds.add(user.id);
			for (const zap of user.zaps) {
				for (const comment of zap.comments) {
					authorIds.add(comment.authorId);
				}
				for (const reaction of zap.reactions) {
					authorIds.add(reaction.authorId);
				}
			}
		}

		const authors = await Promise.all(
			(
				await prisma.user.findMany({
					where: {
						id: {
							in: Array.from(authorIds)
						}
					},
					select: {
						id: true,
						handle: true,
						firstName: true,
						lastName: true,
						profilePictureVersion: true
					}
				})
			).map(async (author) => ({
				...author,
				profilePictureUrl: getProfilePictureUrl(author.id, author.profilePictureVersion)
			}))
		);

		const response = {
			myZaps: await returnZapsWithReactionsAndComments(request.user.user.id, myZaps),
			friend: {
				content: await Promise.all(
					content.map(async (user) => ({
						userId: user.id,
						zaps: await returnZapsWithReactionsAndComments(user.id, user.zaps)
					}))
				),
				users: authors
			}
		};

		return response;
	}
}
