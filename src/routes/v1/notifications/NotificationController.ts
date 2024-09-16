import { RequestWithUser } from "../../../helpers/auth";
import { prisma } from "../../../helpers/db";
import { Controller, Path, Post, Res, Route, Security, Tags, TsoaResponse, Request } from "tsoa";

interface NotificationResponse {
	type: NotificationType;
	targetId?: string;
	title: String;
	content: String;
}

interface NotificationsResponse {
	notifications: NotificationResponse[];
}

type NotificationType =
	| "ZAP_NOW"
	| "FRIEND_REQUEST"
	| "NEW_DAILY_ZAP"
	| "NEW_REACTION"
	| "NEW_COMMENT"
	| "TAGGED";

@Tags("Notifications")
@Route("v1/notifications")
@Security("sessionToken")
export class NotificationController extends Controller {
	@Post("{id}")
	public async fetchNotification(
		@Path() id: string,
		@Res() invalid: TsoaResponse<404, { reason: string }>,
		@Request() request: RequestWithUser
	): Promise<NotificationResponse> {
		const notification = await prisma.notification.findUnique({ where: { id } });

		if (!notification || notification.userId !== request.user.user.id)
			return invalid(404, { reason: "Notification not found" });

		await prisma.notification.delete({ where: { id } });

		return {
			type: notification.type,
			targetId: notification.targetId || undefined,
			title: notification.title,
			content: notification.content
		};
	}

	@Post()
	public async fetchNotifications(
		@Request() request: RequestWithUser
	): Promise<NotificationsResponse> {
		const notifications = await prisma.notification.findMany({
			where: {
				userId: request.user.user.id
			}
		});

		await prisma.notification.deleteMany({
			where: {
				id: {
					in: notifications.map((notification) => notification.id)
				}
			}
		});

		return {
			notifications: notifications.map((notification) => ({
				type: notification.type,
				targetId: notification.targetId || undefined,
				title: notification.title,
				content: notification.content
			}))
		};
	}
}
