import { ReactionType } from "../../enums/ReactionType";

export interface Reaction {
	id: string;
	authorId: string;
	type: ReactionType;
	imageUrl: string;
	/**
	 * @isInt
	 */
	timestamp: number;
}
