export interface CommentResponse {
	id: string;
	authorId: string;
	content: string;
	/**
	 * @isInt
	 */
	timestamp: number;
}
