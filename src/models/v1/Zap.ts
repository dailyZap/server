import { Comment } from "./Comment";
import { Reaction } from "./Reaction";

export interface Zap {
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
	comments: Comment[];
	reactions: Reaction[];
}
