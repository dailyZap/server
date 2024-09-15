import { Controller, Get, Route, Tags } from "tsoa";
import { name, version } from "../../../../package.json";
import { Region } from "@prisma/client";

interface ServerInfoResponse {
	endpoint: string;
	name: string;
	version: string;
	homeRegion: Region;
}

@Tags("Info")
@Route("v1/info")
export class InfoController extends Controller {
	@Get()
	public async getServerInfo(): Promise<ServerInfoResponse> {
		const host = process.env.HOST;
		const port = process.env.PORT;
		const isSSL = process.env.SSL == "true";
		const isDefaultPort = port == "80" || port == "443";

		const endpoint = `http${isSSL ? "s" : ""}://${host}${isDefaultPort ? "" : ":" + port}`;
		const homeRegion = (process.env.HOME_REGION as keyof typeof Region) ?? "EU";

		return { endpoint, name, version, homeRegion };
	}
}
