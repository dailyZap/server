import { Buckets } from "../../../enums/Buckets";
import { hasPermissionsForProfilePicture, RequestWithUser } from "../../../helpers/auth";
import { prisma } from "../../../helpers/db";
import { storage } from "../../../helpers/storage";
import {
	Controller,
	Get,
	Path,
	Produces,
	Query,
	Route,
	Tags,
	Request,
	Security,
	Res,
	TsoaResponse
} from "tsoa";

interface UserGetParams {
	id: string;
	handle: string;
	firstName: string;
	lastName: string;
}

// src/users/usersController.ts

@Tags("Users")
@Route("v1/users")
@Security("sessionToken")
export class UsersController extends Controller {
	@Get("{id}")
	public async getUserById(@Path() id: string): Promise<UserGetParams> {
		const user = await prisma.user.findUnique({ where: { id } });

		if (!user) {
			this.setStatus(404);
			throw new Error("User not found");
		}

		this.setStatus(200);
		return {
			id: user.id,
			handle: user.handle,
			firstName: user.firstName,
			lastName: user.lastName
		};
	}

	@Get("{id}/profile/picture")
	@Produces("image/*")
	public async getProfilePicture(
		@Request() request: RequestWithUser,
		@Path() id: string,
		@Res() unauthorized: TsoaResponse<401, { reason: string }>
	): Promise<Buffer> {
		const hasPermission = await hasPermissionsForProfilePicture(request.user.user.id, id);
		if (!hasPermission) return unauthorized(401, { reason: "Unauthorized" });

		this.setStatus(302);
		this.setHeader(
			"Location",
			await storage.presignedGetObject(Buckets.AVATARS, `${id}.jpg`, 15 * 60)
		);
		return Buffer.from([]);
	}

	@Get()
	public async getUserByHandle(@Query() handle?: string): Promise<UserGetParams[]> {
		const user = await prisma.user.findMany({ where: { handle } });

		if (user.length === 0) {
			this.setStatus(404);
		}

		const response = [];
		for (const u of user) {
			response.push({
				id: u.id,
				handle: u.handle,
				firstName: u.firstName,
				lastName: u.lastName
			});
		}
		return response;
	}
}
