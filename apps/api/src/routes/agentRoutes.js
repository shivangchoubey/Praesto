import express from 'express'
import {generateEnrollmentToken,createAgent,getAgent,updateHeartbeat} from "../controllers/agentController.js"

import { authenticate } from '../middleware/authMiddleware.js';
import { authenticateAgent } from '../middleware/agentAuthMiddleware.js';

const router=express.Router();

router.post("/enrollment-token",authenticate,generateEnrollmentToken);
router.post("/register",createAgent);
router.get("/",authenticate,getAgent);
router.patch("/heartbeat",authenticateAgent,updateHeartbeat);
export default router;