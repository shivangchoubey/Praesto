import express from 'express'
import {createAgent,getAgent,updateHeartbeat} from "../controllers/agentController.js"

const router=express.Router();

router.post("/",createAgent);
router.get("/",getAgent);
router.patch("/:id/heartbeat",updateHeartbeat);
export default router;