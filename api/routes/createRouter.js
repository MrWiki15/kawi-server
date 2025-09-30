import { Router } from "express";
import {
  createNFTCollectionController,
  createNFTLaunchpadController,
} from "../controlers/createController/createController.js";

const createRouter = Router();

createRouter.post("/collection", createNFTCollectionController);
createRouter.post("/launchpad", createNFTLaunchpadController);

export default createRouter;
