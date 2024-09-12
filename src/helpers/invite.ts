import { typeid } from "typeid-js";
import { prisma } from "./db";
import { Prefix } from "./../../src/enums/Prefix";

export async function ensureAndGetServerInvite() {
	const serverInvite = await prisma.invite.findFirst({
		where: {
			userId: null
		},
		omit: {
			code: false
		}
	});

	if (serverInvite) return serverInvite;

	return await prisma.invite.create({
		data: {
			id: typeid(Prefix.INVITE).toString(),
			code: typeid().toString()
		},
		omit: {
			code: false
		}
	});
}

export function getInviteUrl(inviteCode: string) {
	const isSSL = process.env.SSL == "true";
	const isDefaultPort = process.env.PORT == "80" || process.env.PORT == "443";

	return `${isSSL ? "https" : "http"}://${process.env.HOST}${isDefaultPort ? "" : ":" + process.env.PORT}/invite/${inviteCode}`;
}
