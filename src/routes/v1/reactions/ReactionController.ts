import { prisma } from "../../../helpers/db";
import { RequestWithUser, userHasPermissionsForReactionImage } from "../../../helpers/auth";
import {
	Controller,
	Route,
	Security,
	Tags,
	Request,
	Get,
	Produces,
	Path,
	Res,
	TsoaResponse,
	Delete
} from "tsoa";
import { getPresignedReactionUrl } from "../../../helpers/storage";
import { ReactionType } from "../../../enums/ReactionType";

@Tags("Reactions")
@Route("v1/reactions")
@Security("sessionToken")
export class ReactionController extends Controller {
	@Get("{id}/picture")
	@Produces("image/*")
	public async getProfilePicture(
		@Request() request: RequestWithUser,
		@Path() id: string,
		@Res() unauthorized: TsoaResponse<401, { reason: string }>
	): Promise<Buffer> {
		const reaction = await prisma.reaction.findUniqueOrThrow({
			where: {
				id
			}
		});

		const userHasPermission = await userHasPermissionsForReactionImage({
			requestUserId: request.user.user.id,
			assetOwnerId: reaction.authorId
		});

		if (!userHasPermission) return unauthorized(401, { reason: "Unauthorized" });

		this.setStatus(302);
		this.setHeader(
			"Location",
			await getPresignedReactionUrl({
				reactionImageId: reaction.imageId,
				authorId: reaction.authorId,
				reactionType: ReactionType[reaction.type]
			})
		);
		return Buffer.from([]);
	}

	@Delete("{id}")
	public async deleteReaction(
		@Request() request: RequestWithUser,
		@Path() id: string,
		@Res() unauthorized: TsoaResponse<401, { reason: string }>
	): Promise<void> {
		const reaction = await prisma.reaction.findUniqueOrThrow({
			where: {
				id
			}
		});

		if (reaction.authorId !== request.user.user.id) {
			return unauthorized(401, { reason: "Unauthorized" });
		}

		await prisma.reaction.delete({
			where: {
				id
			}
		});
	}
}
