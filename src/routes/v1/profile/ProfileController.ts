import { Buckets } from "../../../enums/Buckets";
import { storage } from "../../../helpers/storage";
import { Controller, Get, Route, Security, Tags, Request, Put } from "tsoa";
import { RequestWithUser } from "src/helpers/auth";
import { prisma } from "../../../helpers/db";
import { getInviteUrl } from "../../../helpers/invite";

interface ProfileResponseProps {
	id: string;
	handle: string;
	firstName: string;
	lastName: string;
	pictureUrl: string;
	inviteUrl?: string;
}

interface PictureResponseProps {
	uploadUrl: string;
}

@Tags("Profile")
@Route("v1/profile")
@Security("sessionToken")
export class ProfileController extends Controller {
	@Put("picture")
	public async setProfilePicture(
		@Request() request: RequestWithUser
	): Promise<PictureResponseProps> {
		return {
			uploadUrl: await storage.presignedPutObject(
				Buckets.AVATARS,
				`${request.user.user.id}.jpg`,
				15 * 60
			)
		};
	}

	@Get()
	public async getProfile(@Request() request: RequestWithUser): Promise<ProfileResponseProps> {
		const invite = await prisma.invite.findUnique({
			where: {
				userId: request.user.user.id
			},
			omit: {
				code: false
			}
		});

		return {
			id: request.user.user.id,
			handle: request.user.user.handle,
			firstName: request.user.user.firstName,
			lastName: request.user.user.lastName,
			pictureUrl: await storage.presignedGetObject(
				Buckets.AVATARS,
				`${request.user.user.id}.jpg`,
				15 * 60
			),
			inviteUrl: invite ? getInviteUrl(invite.code) : undefined
		};
	}
}
