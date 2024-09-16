import { CommentResponse } from "./Comment";
import { ReactionResponse } from "./Reaction";

export interface ZapResponse {
	id: string;
	frontCameraUrl: string;
	backCameraUrl: string;
	/**
	 * @isInt
	 */
	timestamp: number;
	/**
	 * @isInt
	 */
	lateBy?: number;
	comments: CommentResponse[];
	reactions: ReactionResponse[];
}
