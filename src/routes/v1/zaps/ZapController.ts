import { getPresignedZapUrl, getZapPath, storage } from "../../../helpers/storage";
import { userHasPermissionsForZapImage, RequestWithUser } from "../../../helpers/auth";
import { Buckets } from "../../../enums/Buckets";
import { prisma } from "../../../helpers/db";
import { Prefix } from "../../../enums/Prefix";
import { ZapImageType } from "../../../enums/ZapImageType";
import {
	Controller,
	Put,
	Route,
	Request,
	Security,
	Body,
	Tags,
	Path,
	Get,
	Produces,
	Res,
	TsoaResponse,
	Post
} from "tsoa";
import { v7 } from "uuid";
import { fromUUID, typeid } from "typeid-js";
import { Region } from "../../../enums/Region";

interface SetZapResponse {
	zapId: string;
	uploadFrontUrl: string;
	uploadBackUrl: string;
}

interface ZapCreation {
	/**
	 * @isInt
	 */
	timestamp: number;
}

@Tags("Zaps")
@Route("v1/zaps")
@Security("sessionToken")
export class ZapController extends Controller {
	@Put()
	public async createZap(
		@Request() request: RequestWithUser,
		@Body() userParams: ZapCreation
	): Promise<SetZapResponse> {
		const currentMoment = await prisma.moment.findFirstOrThrow({
			where: {
				[`timestamp${Region[request.user.user.region]}`]: {
					lt: new Date()
				}
			},
			orderBy: {
				date: "desc"
			}
		});

		const zapId = fromUUID(
			v7({
				msecs: userParams.timestamp
			}),
			Prefix.ZAP
		).toString();

		await prisma.zap.create({
			data: {
				id: zapId,
				momentId: currentMoment.id,
				authorId: request.user.user.id,
				uploaded: false
			}
		});

		return {
			zapId,
			uploadFrontUrl: await storage.presignedPutObject(
				Buckets.ZAPS,
				getZapPath({
					momentId: currentMoment.id,
					userId: request.user.user.id,
					zapId,
					type: ZapImageType.FRONT
				}),
				15 * 60
			),
			uploadBackUrl: await storage.presignedPutObject(
				Buckets.ZAPS,
				getZapPath({
					momentId: currentMoment.id,
					userId: request.user.user.id,
					zapId,
					type: ZapImageType.BACK
				}),
				15 * 60
			)
		};
	}

	@Put("{id}/uploaded")
	public async setZapUploaded(
		@Request() request: RequestWithUser,
		@Path() id: string
	): Promise<void> {
		const zap = await prisma.zap.findFirstOrThrow({
			where: {
				id
			}
		});

		if (zap.authorId !== request.user.user.id) {
			this.setStatus(403);
			return;
		}

		await prisma.zap.update({
			where: {
				id
			},
			data: {
				uploaded: true
			}
		});
	}

	@Post("{id}/repost")
	public async repostZap(
		@Request() request: RequestWithUser,
		@Path() id: string,
		@Res() forbidden: TsoaResponse<403, { reason: string }>
	): Promise<void> {
		const currentMoment = await prisma.moment.findFirstOrThrow({
			where: {
				[`timestamp${Region[request.user.user.region]}`]: {
					lt: new Date()
				}
			},
			orderBy: {
				date: "desc"
			}
		});

		const zap = await prisma.zap.findFirstOrThrow({
			where: {
				id
			}
		});

		if (currentMoment.id !== zap.momentId) {
			return forbidden(403, { reason: "The Day the Zap was taken on is already over" });
		}

		await prisma.zap.create({
			data: {
				id: typeid(Prefix.ZAP).toString(),
				momentId: zap.momentId,
				authorId: request.user.user.id,
				repostId: zap.id,
				uploaded: true
			}
		});
	}

	@Get("{id}/picture/{side}")
	@Produces("image/*")
	public async getProfilePicture(
		@Request() request: RequestWithUser,
		@Path() id: string,
		@Path() side: ZapImageType,
		@Res() unauthorized: TsoaResponse<401, { reason: string }>,
		@Res() forbidden: TsoaResponse<403, { reason: string }>
	): Promise<Buffer> {
		let zap = await prisma.zap.findUniqueOrThrow({
			where: {
				id
			},
			include: {
				repost: true
			}
		});

		const userHasPermission = await userHasPermissionsForZapImage({
			requestUserId: request.user.user.id,
			assetId: zap.id
		});

		if (!userHasPermission) return unauthorized(401, { reason: "Unauthorized" });

		const currentMoment = await prisma.moment.findFirstOrThrow({
			where: {
				[`timestamp${Region[request.user.user.region]}`]: {
					lt: new Date()
				}
			},
			orderBy: {
				date: "desc"
			}
		});

		if (zap.momentId !== currentMoment.id) {
			return forbidden(403, { reason: "The Day the Zap was taken on is already over" });
		}

		this.setStatus(302);
		this.setHeader(
			"Location",
			await getPresignedZapUrl({
				momentId: zap.repost ? zap.repost.momentId : zap.momentId,
				userId: zap.repost ? zap.repost.authorId : zap.authorId,
				zapId: zap.repost ? zap.repost.id : zap.id,
				type: side
			})
		);
		return Buffer.from([]);
	}
}
