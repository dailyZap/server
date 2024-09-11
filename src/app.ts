import { RegisterRoutes } from "../build/routes";
import swaggerUi from "swagger-ui-express";
import express, { json, urlencoded, Response as ExResponse, Request as ExRequest } from "express";
import { prisma } from "./helpers/db";

export const app = express();

// Use body parser to read sent json payloads
app.use(
	urlencoded({
		extended: true
	})
);
app.use(json());

app.get("/spec.json", async (_req: ExRequest, res: ExResponse) => {
	return res.json(await import("../build/swagger.json"));
});

app.get("/invite/:code", async (req: ExRequest, res: ExResponse) => {
	const invite = await prisma.invite.findFirst({
		where: {
			code: req.params.code
		}
	});

	if (!invite) return res.status(404).send("Invite not found");

	const isDefaultPort = process.env.PORT == "80" || process.env.PORT == "443";
	return res.send(
		`<a href='dailyzap://invite/${process.env.HOST}${isDefaultPort ? "" : ":" + process.env.PORT}/${req.params.code}'>Click here to register</a>`
	);
});

app.use("/docs", swaggerUi.serve, async (_req: ExRequest, res: ExResponse) => {
	return res.send(swaggerUi.generateHTML(await import("../build/swagger.json")));
});

RegisterRoutes(app);
