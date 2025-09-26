import { Router } from "express";
import { listNftController } from "../controlers/marketController/listNftController.js";
import { deslitNftController } from "../controlers/marketController/deslistNftController.js";
import { buyNftController } from "../controlers/marketController/buyNftController.js";
import { codeNftController } from "../controlers/marketController/codeNftController.js";

const marketRouter = Router();

marketRouter.post("/list/code", codeNftController);
marketRouter.post("/list", listNftController);
marketRouter.post("/deslist", deslitNftController);
marketRouter.post("/buy", buyNftController);

export default marketRouter;
