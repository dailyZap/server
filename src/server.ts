// src/server.ts
import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { ensureAndGetServerInvite } from "./helpers/invite";
import { Buckets } from "./enums/Buckets";
import { storage } from "./helpers/storage";

const port = process.env.PORT || 80;

async function main() {
	// ensure buckets
	for (const bucket of Object.values(Buckets)) {
		if (!(await storage.bucketExists(bucket)))
			await storage.makeBucket(bucket, process.env.S3_REGION);
	}

	// ensureAndGetServerInvite
	const invite = await ensureAndGetServerInvite();

	const isSSL = process.env.SSL == "true";
	const isDefaultPort = process.env.PORT == "80" || process.env.PORT == "443";
	console.log(
		`Server Invite Link: ${isSSL ? "https" : "http"}://${process.env.HOST}${isDefaultPort ? "" : ":" + process.env.PORT}/invite/${invite.code}`
	);

	// run app
	app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
}

main();
