import { Client } from "minio";
import { Buckets } from "../enums/Buckets";
import { ReactionType } from "../enums/ReactionType";
import { ZapImageType } from "../enums/ZapImageType";

export const storage = new Client({
	endPoint: process.env.S3_ENDPOINT!,
	port: parseInt(process.env.S3_PORT!),
	useSSL: process.env.S3_SECURE === "true",
	accessKey: process.env.S3_ACCESS_KEY!,
	secretKey: process.env.S3_SECRET_KEY!
});

interface ReactionImageProperties {
	momentId: string;
	zapId: string;
	authorId: string;
	reactionType: ReactionType;
}

interface ZapImageProperties {
	momentId: string;
	userId: string;
	zapId: string;
	type: ZapImageType;
}

export async function getPresignedReactionUrl(props: ReactionImageProperties) {
	let path = `${props.authorId}/${props.reactionType}.jpg`;

	if (props.reactionType == ReactionType.HIGH_VOLTAGE) {
		path = `${props.momentId}/${props.zapId}/${props.authorId}.jpg`;
	}
	return await storage.presignedGetObject(Buckets.REACTIONS, path, 15 * 60);
}

export async function getPresignedZapUrl(props: ZapImageProperties) {
	const path = `${props.momentId}/${props.userId}/${props.zapId}-${props.type}.jpg`;

	return await storage.presignedGetObject(Buckets.REACTIONS, path, 15 * 60);
}
