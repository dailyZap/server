import { Controller, Get, Route, Security, Tags, Request } from "tsoa";
import { prisma } from "../../../helpers/db";
import { extractTimeFromTypeIdAsNumber } from "../../../helpers/time";
import { getPresignedReactionUrl, getPresignedZapUrl, storage } from "../../../helpers/storage";
import { Buckets } from "../../../enums/Buckets";
import { ReactionType } from "../../../enums/ReactionType";
import { ZapImageType } from "../../../enums/ZapImageType";
import { RequestWithUser } from "../../../helpers/auth";

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
	imageUrl?: string;
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
	late: number;
	comments: Comment[];
	reactions: Reaction[];
}

interface Content {
	userId: string;
	zaps: Zap[];
}

interface FeedResponseProps {
	content: Content[];
	authors: Author[];
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
						friendsA: {
							some: {
								id: request.user.user.id
							}
						}
					},
					{
						friendsB: {
							some: {
								id: request.user.user.id
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
						momentId: currentMoment.id
					},
					include: {
						comments: true,
						reactions: true
					}
				}
			}
		});

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
						lastName: true
					}
				})
			).map(async (author) => ({
				...author,
				profilePictureUrl: await storage.presignedGetObject(
					Buckets.AVATARS,
					`${author.id}.jpg`,
					15 * 60
				)
			}))
		);

		return {
			content: await Promise.all(
				content.map(async (user) => ({
					userId: user.id,
					zaps: await Promise.all(
						user.zaps.map(async (zap) => ({
							id: zap.id,
							frontCameraUrl: await getPresignedZapUrl({
								momentId: currentMoment.id,
								userId: user.id,
								zapId: zap.id,
								type: ZapImageType.FRONT
							}),
							backCameraUrl: await getPresignedZapUrl({
								momentId: currentMoment.id,
								userId: user.id,
								zapId: zap.id,
								type: ZapImageType.BACK
							}),
							timestamp: extractTimeFromTypeIdAsNumber(zap.id),
							late: currentMoment.timestamp.getTime() - extractTimeFromTypeIdAsNumber(zap.id),
							comments: zap.comments.map((comment) => ({
								id: comment.id,
								authorId: comment.authorId,
								content: comment.content,
								timestamp: extractTimeFromTypeIdAsNumber(comment.id)
							})),
							reactions: await Promise.all(
								zap.reactions.map(async (reaction) => ({
									id: reaction.id,
									authorId: reaction.authorId,
									type: ReactionType[reaction.type],
									imageUrl: await getPresignedReactionUrl({
										momentId: currentMoment.id,
										zapId: zap.id,
										authorId: reaction.authorId,
										reactionType: ReactionType[reaction.type]
									}),
									timestamp: extractTimeFromTypeIdAsNumber(reaction.id)
								}))
							)
						}))
					)
				}))
			),
			authors
		};
	}
}
