import { Region } from "../enums/Region";

export function validateEnv() {
	if (!process.env.REGION) {
		const regions = Object.values(Region);
		throw new Error(
			`REGION not set. Please set it in your .env file. Valid Regions are ${'"' + regions.slice(0, -1).join('", "')}" & "${regions[regions.length - 1]}".`
		);
	}
}
