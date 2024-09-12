// src/server.ts
import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { ensureAndGetServerInvite, getInviteUrl } from "./helpers/invite";
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

	console.log(`Server Invite Link: ${getInviteUrl(invite.code)}`);

	// run app
	app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
}

main();
