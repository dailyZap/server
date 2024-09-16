import { ReactionType } from "../../enums/ReactionType";

export interface ReactionResponse {
	id: string;
	authorId: string;
	type: ReactionType;
	imageUrl: string;
	/**
	 * @isInt
	 */
	timestamp: number;
}
