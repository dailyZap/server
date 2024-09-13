import { getZapUrl, storage } from "../../../helpers/storage";
import { RequestWithUser } from "../../../helpers/auth";
import { Buckets } from "../../../enums/Buckets";
import { prisma } from "../../../helpers/db";
import { Prefix } from "../../../enums/Prefix";
import { ZapImageType } from "../../../enums/ZapImageType";
import { Controller, Put, Route, Request, Security, Body, Tags, Path } from "tsoa";
import { v7 } from "uuid";
import { fromUUID } from "typeid-js";

interface ZapResponseProps {
	zapId: string;
	uploadFrontUrl: string;
	uploadBackUrl: string;
}

interface ZapCreationParams {
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
		@Body() userParams: ZapCreationParams
	): Promise<ZapResponseProps> {
		const currentMoment = await prisma.moment.findFirstOrThrow({
			where: {
				timestamp: {
					lt: new Date()
				}
			},
			orderBy: {
				timestamp: "desc"
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
				getZapUrl({
					momentId: currentMoment.id,
					userId: request.user.user.id,
					zapId,
					type: ZapImageType.FRONT
				}),
				15 * 60
			),
			uploadBackUrl: await storage.presignedPutObject(
				Buckets.ZAPS,
				getZapUrl({
					momentId: currentMoment.id,
					userId: request.user.user.id,
					zapId,
					type: ZapImageType.BACK
				}),
				15 * 60
			)
		};
	}

	@Put("{zapId}/uploaded")
	public async setZapUploaded(
		@Request() request: RequestWithUser,
		@Path() zapId: string
	): Promise<void> {
		const zap = await prisma.zap.findFirstOrThrow({
			where: {
				id: zapId
			}
		});

		if (zap.authorId !== request.user.user.id) {
			this.setStatus(403);
			return;
		}

		await prisma.zap.update({
			where: {
				id: zapId
			},
			data: {
				uploaded: true
			}
		});
	}
}
