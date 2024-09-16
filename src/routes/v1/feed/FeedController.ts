import { Controller, Get, Route, Security, Tags, Request } from "tsoa";
import { prisma } from "../../../helpers/db";
import { extractTimeFromTypeIdAsNumber } from "../../../helpers/time";
import { getPresignedReactionUrl, getProfilePictureUrl, getZapUrl } from "../../../helpers/storage";
import { ReactionType } from "../../../enums/ReactionType";
import { ZapImageType } from "../../../enums/ZapImageType";
import { RequestWithUser } from "../../../helpers/auth";
import { Prefix } from "../../../enums/Prefix";
import { lateTime } from "../../../const/lateTime";
import { User } from "../../../models/v1/User";
import { Moment } from "@prisma/client";
import { Region } from "../../../enums/Region";
import { Zap } from "../../../models/v1/Zap";

interface Content {
	userId: string;
	zaps: Zap[];
}

interface Feed {
	myZaps: Zap[];
	friend: {
		content: Content[];
		users: User[];
	};
}

@Tags("Feed")
@Route("v1/feed")
@Security("sessionToken")
export class FeedController extends Controller {
	@Get()
	public async getFeed(@Request() request: RequestWithUser): Promise<Feed> {
		const now = new Date();

		const currentMoments: Record<Region, Moment> = Object.fromEntries(
			await Promise.all(
				Object.values(Region).map(async (region) => {
					const moment = await prisma.moment.findFirstOrThrow({
						where: {
							[`timestamp${region}`]: {
								lt: now
							}
						},
						orderBy: {
							date: "desc"
						}
					});
					return [region, moment];
				})
			)
		);

		const zapWhereCondition = {
			OR: Object.values(Region).map((region) => ({
				momentId: currentMoments[region].id,
				author: {
					region: region
				}
			}))
		};

		const content = await prisma.user.findMany({
			where: {
				zaps: {
					some: zapWhereCondition
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
						...zapWhereCondition,
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
						},
						author: true
					}
				}
			}
		});

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
						profilePictureVersion: true,
						region: true
					}
				})
			).map(async (author) => ({
				id: author.id,
				handle: author.handle,
				firstName: author.firstName,
				lastName: author.lastName,
				region: Region[author.region],
				profilePictureUrl: getProfilePictureUrl(author.id, author.profilePictureVersion)
			}))
		);

		async function returnZapsWithReactionsAndComments(zaps: (typeof content)[0]["zaps"]) {
			return await Promise.all(
				zaps.map(async (zap) => {
					const region = authors.find((author) => author.id === zap.authorId)!.region;
					const lateBy =
						extractTimeFromTypeIdAsNumber(zap.id, Prefix.ZAP) -
						(currentMoments[region][`timestamp${region}`].getTime() + lateTime);
					return {
						id: zap.id,
						frontCameraUrl: getZapUrl(zap.id, ZapImageType.FRONT),
						backCameraUrl: getZapUrl(zap.id, ZapImageType.BACK),
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

		const response = {
			myZaps: await returnZapsWithReactionsAndComments(myZaps),
			friend: {
				content: await Promise.all(
					content.map(async (user) => ({
						userId: user.id,
						zaps: await returnZapsWithReactionsAndComments(user.zaps)
					}))
				),
				users: authors
			}
		};

		return response;
	}
}
