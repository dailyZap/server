import { Prefix } from "../../../enums/Prefix";
import { prisma } from "../../../helpers/db";
import { mailer } from "../../../helpers/mail";
import { extractTimestampFromUUIDv7 } from "../../../helpers/time";
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
import { Region } from "../../../enums/Region";

interface UserCreationParams {
	handle: string;
	email: string;
	firstName: string;
	lastName: string;
	region: Region;
}

interface OTPParams {
	loginToken: string;
	otp: string;
	deviceToken: string;
}

interface LoginParams {
	handleOrEmail: string;
}

type UserUniqueFields = "handle" | "email";

interface LoginToken {
	loginToken: string;
}

interface Session {
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
		@Res() failedUniqueConstraint: TsoaResponse<409, { reason: string; field: UserUniqueFields }>,
		@Res() failedMailDelivery: TsoaResponse<500, { reason: string; description: string }>
	): Promise<LoginToken> {
		// TODO: Validate E-Mail

		const otp = randomInt(100000, 999999).toString();
		const loginToken = typeid().toString();

		await prisma.user
			.create({
				data: {
					id: typeid(Prefix.USER).toString(),
					handle: userParams.handle,
					email: userParams.email,
					firstName: userParams.firstName,
					lastName: userParams.lastName,
					otp,
					loginToken,
					region: userParams.region
				}
			})
			.catch((error) => {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
					const field = (error.meta!.target as UserUniqueFields[])[0];
					return failedUniqueConstraint(409, { reason: `Field not unique`, field });
				}
			});

		await mailer
			.sendMail({
				from: process.env.MAIL_FROM,
				to: userParams.email,
				subject: "One-Time Password",
				text: `Your One-Time Password is: ${otp}`
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
		@Body() userParams: LoginParams,
		@Res() invalidUser: TsoaResponse<404, { reason: string }>,
		@Res() failedMailDelivery: TsoaResponse<500, { reason: string; description: string }>
	): Promise<LoginToken> {
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

		const otp = randomInt(100000, 999999).toString();
		const loginToken = typeid().toString();

		await prisma.user.update({
			where: {
				id: user.id
			},
			data: {
				loginToken,
				otp
			}
		});

		await mailer
			.sendMail({
				from: process.env.MAIL_FROM,
				to: `${user.firstName} ${user.lastName} <${user.email}>`,
				subject: "One-Time Password",
				text: `Your One-Time Password is: ${otp}`
			})
			.catch(async (error) => {
				return failedMailDelivery(500, {
					reason: "Mail delivery failed",
					description: error.message
				});
			});

		return { loginToken };
	}

	@Post("otp")
	public async otp(
		@Body() userParams: OTPParams,
		@Res() unauthorized: TsoaResponse<401, { reason: string }>,
		@Res() forbidden: TsoaResponse<403, { reason: string }>
	): Promise<Session> {
		const user = await prisma.user.findFirst({
			where: {
				loginToken: userParams.loginToken
			},
			omit: {
				otp: false
			}
		});

		if (!user) return unauthorized(401, { reason: "Invalid Login Token" });

		const loginTokenCreationDate = extractTimestampFromUUIDv7(
			toUUID(fromString(userParams.loginToken))
		);
		const now = new Date();
		if (now.getTime() - loginTokenCreationDate.getTime() > 15 * 60 * 1000)
			return forbidden(403, { reason: "Login Token Expired" });

		if (user.otp !== userParams.otp) return forbidden(403, { reason: "Invalid otp" });

		const oldLoginFromSameDevice = await prisma.user.findUnique({
			where: {
				deviceToken: userParams.deviceToken
			}
		});

		if (oldLoginFromSameDevice) {
			await prisma.user.update({
				where: {
					id: oldLoginFromSameDevice.id
				},
				data: {
					deviceToken: null,
					sessionToken: null,
					loginToken: null,
					otp: null
				}
			});
		}

		const sessionToken = randomBytes(16).toString("base64");
		await prisma.user.update({
			where: {
				id: user.id
			},
			data: {
				sessionToken,
				deviceToken: userParams.deviceToken,
				loginToken: null,
				otp: null
			}
		});

		return { sessionToken };
	}
}
