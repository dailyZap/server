import { Buckets } from "../../../enums/Buckets";
import { storage } from "../../../helpers/storage";
import { Controller, Get, Route, Security, Tags, Request, Put, Produces, Body } from "tsoa";
import { RequestWithUser } from "src/helpers/auth";
import { prisma } from "../../../helpers/db";
import { getInviteUrl } from "../../../helpers/invite";
import { Region } from "../../../enums/Region";

interface ProfileResponseProps {
	id: string;
	handle: string;
	firstName: string;
	lastName: string;
	region: Region;
	pictureUrl: string;
	inviteUrl?: string;
}

interface SetPictureResponseProps {
	uploadUrl: string;
}

interface RegionUpdateParams {
	region: Region;
}

@Tags("Profile")
@Route("v1/profile")
@Security("sessionToken")
export class ProfileController extends Controller {
	@Get("picture")
	@Produces("image/*")
	public async getProfilePicture(@Request() request: RequestWithUser): Promise<Buffer> {
		this.setStatus(302);
		this.setHeader(
			"Location",
			await storage.presignedGetObject(Buckets.AVATARS, `${request.user.user.id}.jpg`, 15 * 60)
		);
		return Buffer.from([]);
	}

	@Put("picture")
	public async setProfilePicture(
		@Request() request: RequestWithUser
	): Promise<SetPictureResponseProps> {
		return {
			uploadUrl: await storage.presignedPutObject(
				Buckets.AVATARS,
				`${request.user.user.id}.jpg`,
				15 * 60
			)
		};
	}

	@Put("picture/uploaded")
	public async setProfilePictureUploaded(@Request() request: RequestWithUser): Promise<void> {
		await prisma.user.update({
			where: {
				id: request.user.user.id
			},
			data: {
				profilePictureVersion: {
					increment: 1
				}
			}
		});
	}

	@Put("region")
	public async setRegion(
		@Request() request: RequestWithUser,
		@Body() userParams: RegionUpdateParams
	): Promise<void> {
		await prisma.user.update({
			where: {
				id: request.user.user.id
			},
			data: {
				region: userParams.region
			}
		});
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
			region: Region[request.user.user.region],
			pictureUrl: await storage.presignedGetObject(
				Buckets.AVATARS,
				`${request.user.user.id}.jpg`,
				15 * 60
			),
			inviteUrl: invite ? getInviteUrl(invite.code) : undefined
		};
	}
}
