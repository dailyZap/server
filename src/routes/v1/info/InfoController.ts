import { Controller, Get, Route, Tags } from "tsoa";
import { name, version } from "../../../../package.json";
import { Region } from "../../../enums/Region";

interface ServerInfo {
	endpoint: string;
	name: string;
	version: string;
	region: Region;
}

@Tags("Info")
@Route("v1/info")
export class InfoController extends Controller {
	@Get()
	public async getServerInfo(): Promise<ServerInfo> {
		const host = process.env.HOST;
		const port = process.env.PORT;
		const isSSL = process.env.SSL == "true";
		const isDefaultPort = port == "80" || port == "443";

		const endpoint = `http${isSSL ? "s" : ""}://${host}${isDefaultPort ? "" : ":" + port}`;
		const region = (process.env.REGION as Region) ?? Region.EU;

		return { endpoint, name, version, region };
	}
}
