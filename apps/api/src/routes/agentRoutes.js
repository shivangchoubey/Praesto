import express from 'express'
import {generateEnrollmentToken,createAgent,getAgent,updateHeartbeat,getNextDeployment,updateDeploymentStatus,createDeploymentLog} from "../controllers/agentController.js"

import { authenticate } from '../middleware/authMiddleware.js';
import { authenticateAgent } from '../middleware/agentAuthMiddleware.js';

const router=express.Router();

router.post("/enrollment-token",authenticate,generateEnrollmentToken);
router.post("/register",createAgent);
router.get("/",authenticate,getAgent);
router.patch("/heartbeat",authenticateAgent,updateHeartbeat);
router.get("/deployments/next",authenticateAgent,getNextDeployment);
router.patch("/deployments/:deploymentId/status",authenticateAgent,updateDeploymentStatus);
router.post("/deployments/:deploymentId/logs",authenticateAgent,createDeploymentLog);
export default router;