// src/server.ts
import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { ensureAndGetServerInvite, getInviteUrl } from "./helpers/invite";
import { Buckets } from "./enums/Buckets";
import { storage } from "./helpers/storage";
import { checkAuth, client } from "./libs/push-gateway/services.gen";
import { updateMomentsFromPushGateway } from "./helpers/moments";
import { validateEnv } from "./helpers/env";

const port = process.env.PORT || 80;

async function main() {
	validateEnv();

	// ensure buckets
	for (const bucket of Object.values(Buckets)) {
		if (!(await storage.bucketExists(bucket)))
			await storage.makeBucket(bucket, process.env.S3_REGION);
	}

	// ensureAndGetServerInvite
	const invite = await ensureAndGetServerInvite();

	console.log(`Server Invite Link: ${getInviteUrl(invite.code)}`);

	client.setConfig({
		baseUrl:
			process.env.NODE_ENV == "development"
				? process.env.PUSH_GATEWAY_URL!
				: "https://gateway.dailyzap.me/api"
	});

	client.interceptors.request.use((request: any) => {
		request.headers.set("X-API-KEY", process.env.PUSH_GATEWAY_API_KEY!);
		return request;
	});

	const response = await checkAuth().catch(() => {
		console.error(
			"Failed to connect to push gateway! Please register at https://gateway.dailyzap.me or check your API key! The Server will not be able to serve requests without a connection to the push gateway."
		);
	});

	if (response) {
		console.log("Connected to push gateway");
	}

	await updateMomentsFromPushGateway();

	// update moments every 24 hours
	setInterval(updateMomentsFromPushGateway, 24 * 60 * 60 * 1000);

	// run app
	app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
}

main();
