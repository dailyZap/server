import { getMoments } from "../libs/push-gateway/services.gen";
import { prisma } from "./db";

export async function updateMomentsFromPushGateway() {
	const lastMoment = await prisma.moment.findFirst({
		orderBy: {
			timestamp: "desc"
		}
	});

	const moments = await getMoments({
		query: { after: lastMoment ? lastMoment.timestamp.getTime() : undefined }
	});

	if (!moments.data?.moments) return;

	for (const moment of moments.data?.moments!) {
		await prisma.moment.create({
			data: {
				id: moment.id,
				timestamp: new Date(moment.timestamp)
			}
		});
	}
}
