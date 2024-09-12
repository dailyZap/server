// src/server.ts
import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { ensureAndGetServerInvite, getInviteUrl } from "./helpers/invite";
import { Buckets } from "./enums/Buckets";
import { storage } from "./helpers/storage";
import { checkAuth, client, getMoments } from "./libs/push-gateway/services.gen";
import { prisma } from "./helpers/db";

const port = process.env.PORT || 80;

async function main() {
	// ensure buckets
	for (const bucket of Object.values(Buckets)) {
		if (!(await storage.bucketExists(bucket)))
			await storage.makeBucket(bucket, process.env.S3_REGION);
	}

	// ensureAndGetServerInvite
	const invite = await ensureAndGetServerInvite();

	console.log(`Server Invite Link: ${getInviteUrl(invite.code)}`);

	client.setConfig({
		baseUrl: process.env.PUSH_GATEWAY_URL!
	});

	client.interceptors.request.use((request: any) => {
		request.headers.set("X-API-KEY", process.env.PUSH_GATEWAY_API_KEY!);
		return request;
	});

	const response = await checkAuth().catch(() => {
		console.error("Failed to connect to push gateway");
		process.exit(1);
	});

	if (response.error) {
		console.error("Failed to authenticate with push gateway");
		process.exit(1);
	} else {
		console.log("Connected to push gateway");
	}
	const lastMoment = await prisma.moment.findFirst({
		orderBy: {
			timestamp: "desc"
		}
	});

	const moments = await getMoments({
		query: { after: lastMoment ? lastMoment.timestamp.getTime() : undefined }
	});

	for (const moment of moments.data?.moments!) {
		await prisma.moment.create({
			data: {
				id: moment.id,
				timestamp: new Date(moment.timestamp)
			}
		});
	}

	// run app
	app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
}

main();
