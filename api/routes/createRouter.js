import { Router } from "express";
import {
  createNFTCollectionController,
} from "../controlers/createController/createController.js";

const createRouter = Router();

createRouter.post("/collection", createNFTCollectionController);

export default createRouter;
