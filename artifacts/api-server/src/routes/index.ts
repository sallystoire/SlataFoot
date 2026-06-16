import { Router, type IRouter } from "express";
import healthRouter from "./health";
import matchImageRouter from "./matchImage";
import uploadBgRouter from "./uploadBg";
import profileImageRouter from "./profileImage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(matchImageRouter);
router.use(uploadBgRouter);
router.use(profileImageRouter);

export default router;
