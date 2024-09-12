// This file is auto-generated by @hey-api/openapi-ts

export const NotificationSchema = {
	properties: {
		deviceToken: {
			type: "string"
		},
		notificationId: {
			type: "string"
		}
	},
	required: ["deviceToken", "notificationId"],
	type: "object",
	additionalProperties: false
} as const;

export const MomentSchema = {
	properties: {
		id: {
			type: "string"
		},
		timestamp: {
			type: "integer",
			format: "date-time"
		}
	},
	required: ["id", "timestamp"],
	type: "object",
	additionalProperties: false
} as const;
