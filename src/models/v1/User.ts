import { Region } from "../../enums/Region";

export interface UserResponse {
	id: string;
	handle: string;
	firstName: string;
	lastName: string;
	region: Region;
	profilePictureUrl: string;
}
