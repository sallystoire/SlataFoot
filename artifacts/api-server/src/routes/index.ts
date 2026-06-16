import { Router, type IRouter } from "express";
import healthRouter from "./health";
import matchImageRouter from "./matchImage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(matchImageRouter);

export default router;
