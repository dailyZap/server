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

const isSSL = process.env.SSL == "true";
const isDefaultPort = process.env.PORT == "80" || process.env.PORT == "443";

interface ReactionImageProperties {
	authorId: string;
	reactionType: ReactionType;
	reactionImageId: string;
}

interface ZapImageProperties {
	momentId: string;
	userId: string;
	zapId: string;
	type: ZapImageType;
}

export async function getPresignedReactionUrl(props: ReactionImageProperties) {
	return await storage.presignedGetObject(Buckets.REACTIONS, getReactionUrl(props), 15 * 60);
}

export function getReactionUrl(props: ReactionImageProperties) {
	return `${props.authorId}/${props.reactionType}/${props.reactionImageId}.jpg`;
}

export async function getPresignedZapUrl(props: ZapImageProperties) {
	return await storage.presignedGetObject(Buckets.ZAPS, getZapUrl(props), 15 * 60);
}

export function getZapUrl(props: ZapImageProperties) {
	return `${props.momentId}/${props.userId}/${props.zapId}-${props.type}.jpg`;
}

export function getProfilePictureUrl(userId: string, version: number) {
	return `${isSSL ? "https" : "http"}://${process.env.HOST}${isDefaultPort ? "" : ":" + process.env.PORT}/v1/users/${userId}/profile/picture?v=${version}`;
}
