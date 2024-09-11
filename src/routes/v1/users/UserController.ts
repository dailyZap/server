import { prisma } from "../../../../src/helpers/db";

interface UserGetParams {
	id: string;
	handle: string;
	firstName: string;
	lastName: string;
}

// src/users/usersController.ts
import { Controller, Get, Path, Query, Route, Tags } from "tsoa";

@Tags("Users")
@Route("users")
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
