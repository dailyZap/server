import { Client } from "minio";

export const storage = new Client({
	endPoint: process.env.S3_ENDPOINT!,
	port: parseInt(process.env.S3_PORT!),
	useSSL: process.env.S3_SECURE === "true",
	accessKey: process.env.S3_ACCESS_KEY!,
	secretKey: process.env.S3_SECRET_KEY!
});
