import { Prefix } from "../../../../src/enums/Prefix";
import { prisma } from "../../../../src/helpers/db";

interface Invite {
	id: string;
	code: String;
}

interface User {
	id: string;
	updatedAt: Date;
	handle: string;
	email: string;
	firstName: string;
	lastName: string;
	invites: Invite[];
	twoFaCode?: String;
	sessionToken?: String;
}

type UserGetParams = Pick<User, "id" | "handle" | "firstName" | "lastName">;
type UserCreationParams = Pick<User, "handle" | "email" | "firstName" | "lastName">;

// src/users/usersController.ts
import { Body, Controller, Get, Path, Post, Query, Route, SuccessResponse } from "tsoa";
import { typeid } from "typeid-js";

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
	public async getUserByHandle(@Query() handle: string): Promise<UserGetParams> {
		const user = await prisma.user.findUnique({ where: { handle } });

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

	@SuccessResponse("201", "Created") // Custom success response
	@Post()
	public async createUser(@Body() requestBody: UserCreationParams): Promise<void> {
		this.setStatus(201); // set return status 201
		const user = await prisma.user.create({
			data: {
				id: typeid(Prefix.USER).toString(),
				...requestBody
			}
		});
		if (!user) {
			this.setStatus(500);
			throw new Error("User not created");
		}
		return;
	}
}
