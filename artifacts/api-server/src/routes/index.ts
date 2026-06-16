import { Router, type IRouter } from "express";
import healthRouter from "./health";
import matchImageRouter from "./matchImage";
import uploadBgRouter from "./uploadBg";

const router: IRouter = Router();

router.use(healthRouter);
router.use(matchImageRouter);
router.use(uploadBgRouter);

export default router;
