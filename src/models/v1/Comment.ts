export interface Comment {
	id: string;
	authorId: string;
	content: string;
	/**
	 * @isInt
	 */
	timestamp: number;
}
