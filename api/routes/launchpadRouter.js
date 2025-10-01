import { Router } from "express";
import { mintLaunchpadController } from "../controlers/launchpadController/mintLaunchpadController.js";

const launchpadRouter = Router();

launchpadRouter.post("/mint", mintLaunchpadController);

export default launchpadRouter;
