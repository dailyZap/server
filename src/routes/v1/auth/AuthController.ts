import { Prefix } from "../../../../src/enums/Prefix";
import { prisma } from "../../../../src/helpers/db";
import { mailer } from "../../../../src/helpers/mail";
import { extractTimestampFromUUIDv7 } from "../../../../src/helpers/time";
import {
	Body,
	Controller,
	Get,
	Post,
	Put,
	Res,
	Route,
	SuccessResponse,
	Tags,
	TsoaResponse
} from "tsoa";
import { fromString, toUUID, typeid } from "typeid-js";
import { randomInt, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";

interface UserCreationParams {
	handle: string;
	email: string;
	firstName: string;
	lastName: string;
}

interface UserTwoFaParams {
	loginToken: string;
	twoFaCode: string;
	deviceToken: string;
}

interface UserLoginParams {
	handleOrEmail: string;
}

type uniqueFields = "handle" | "email";

interface RegisterReturnParams {
	loginToken: string;
}

interface LoginReturnParams {
	loginToken: string;
}

interface TwoFaReturnParams {
	sessionToken: string;
}

@Tags("Auth")
@Route("v1/auth")
export class AuthController extends Controller {
	@Get("invite/{code}")
	public async checkInvite(
		code: string,
		@Res() invalid: TsoaResponse<404, { reason: string }>
	): Promise<void> {
		const invite = await prisma.invite.findFirst({
			where: {
				code
			}
		});

		if (!invite) return invalid(404, { reason: "Invite not found" });

		return;
	}

	@SuccessResponse("201", "Created")
	@Put("register")
	public async register(
		@Body() userParams: UserCreationParams,
		@Res() failedUniqueConstraint: TsoaResponse<409, { reason: string; field: uniqueFields }>,
		@Res() failedMailDelivery: TsoaResponse<500, { reason: string; description: string }>
	): Promise<RegisterReturnParams> {
		// TODO: Validate E-Mail

		const twoFaCode = randomInt(100000, 999999).toString();
		const loginToken = typeid().toString();

		await prisma.user
			.create({
				data: {
					id: typeid(Prefix.USER).toString(),
					handle: userParams.handle,
					email: userParams.email,
					firstName: userParams.firstName,
					lastName: userParams.lastName,
					twoFaCode,
					loginToken
				}
			})
			.catch((error) => {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
					const field = (error.meta!.target as uniqueFields[])[0];
					return failedUniqueConstraint(409, { reason: `Field not unique`, field });
				}
			});

		await mailer
			.sendMail({
				from: process.env.MAIL_FROM,
				to: userParams.email,
				subject: "2FA Code",
				text: `Your 2FA Code is: ${twoFaCode}`
			})
			.catch(async (error) => {
				await prisma.user.delete({
					where: {
						handle: userParams.handle
					}
				});
				return failedMailDelivery(500, {
					reason: "Mail delivery failed",
					description: error.message
				});
			});

		return { loginToken };
	}

	@Post("login")
	public async login(
		@Body() userParams: UserLoginParams,
		@Res() invalidUser: TsoaResponse<404, { reason: string }>,
		@Res() failedMailDelivery: TsoaResponse<500, { reason: string; description: string }>
	): Promise<LoginReturnParams> {
		const user = await prisma.user.findFirst({
			where: {
				OR: [
					{
						handle: userParams.handleOrEmail
					},
					{
						email: userParams.handleOrEmail
					}
				]
			}
		});

		if (!user) return invalidUser(404, { reason: "User not found" });

		const twoFaCode = randomInt(100000, 999999).toString();
		const loginToken = typeid().toString();

		await prisma.user.update({
			where: {
				id: user.id
			},
			data: {
				loginToken,
				twoFaCode
			}
		});

		await mailer
			.sendMail({
				from: process.env.MAIL_FROM,
				to: user.email,
				subject: "2FA Code",
				text: `Your 2FA Code is: ${twoFaCode}`
			})
			.catch(async (error) => {
				return failedMailDelivery(500, {
					reason: "Mail delivery failed",
					description: error.message
				});
			});

		return { loginToken };
	}

	@Post("twoFa")
	public async twoFa(
		@Body() userParams: UserTwoFaParams,
		@Res() unauthorized: TsoaResponse<401, { reason: string }>,
		@Res() forbidden: TsoaResponse<403, { reason: string }>
	): Promise<TwoFaReturnParams> {
		const user = await prisma.user.findFirst({
			where: {
				loginToken: userParams.loginToken
			},
			omit: {
				twoFaCode: false
			}
		});

		if (!user) return unauthorized(401, { reason: "Invalid Login Token" });

		const loginTokenCreationDate = extractTimestampFromUUIDv7(
			toUUID(fromString(userParams.loginToken))
		);
		const now = new Date();
		if (now.getTime() - loginTokenCreationDate.getTime() > 15 * 60 * 1000)
			return forbidden(403, { reason: "Login Token Expired" });

		if (user.twoFaCode !== userParams.twoFaCode)
			return forbidden(403, { reason: "Invalid 2FA Code" });

		const sessionToken = randomBytes(16).toString("base64");
		await prisma.user.update({
			where: {
				id: user.id
			},
			data: {
				sessionToken,
				deviceToken: userParams.deviceToken,
				loginToken: null,
				twoFaCode: null
			}
		});

		return { sessionToken };
	}
}
