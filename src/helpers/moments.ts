import { getMoments } from "../libs/push-gateway/services.gen";
import { prisma } from "./db";

export async function updateMomentsFromPushGateway() {
	const lastMoment = await prisma.moment.findFirst({
		orderBy: {
			date: "desc"
		}
	});

	const moments = await getMoments({
		query: { after: lastMoment ? lastMoment.date.getTime() : undefined }
	});

	if (!moments.data?.moments) {
		console.error("Failed to fetch moments from push gateway");
		return;
	}

	for (const moment of moments.data?.moments!) {
		await prisma.moment.create({
			data: {
				id: moment.id,
				date: new Date(moment.date),
				// europe
				timestampEU: new Date(moment.time.EU),
				// america
				timestampUS: new Date(moment.time.US),
				// west asia
				timestampWA: new Date(moment.time.WA),
				// east asia
				timestampEA: new Date(moment.time.EA)
			}
		});
	}
}
