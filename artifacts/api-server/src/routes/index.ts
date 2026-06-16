import { Router, type IRouter } from "express";
import healthRouter from "./health";
import matchImageRouter from "./matchImage";
import uploadBgRouter from "./uploadBg";
import profileImageRouter from "./profileImage";
import ticketImageRouter from "./ticketImage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(matchImageRouter);
router.use(uploadBgRouter);
router.use(profileImageRouter);
router.use(ticketImageRouter);

export default router;
