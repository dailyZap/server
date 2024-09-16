import { Region } from "../../enums/Region";

export interface User {
	id: string;
	handle: string;
	firstName: string;
	lastName: string;
	region: Region;
	profilePictureUrl: string;
}
