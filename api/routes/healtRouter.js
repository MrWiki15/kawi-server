import { Router } from "express";
import { healthController } from "../controlers/healtController/health.js";

const healthRouter = Router();

healthRouter.get("/", healthController);

export default healthRouter;
