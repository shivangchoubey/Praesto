import express from 'express';

import { createDeployment } from '../controllers/deploymentController.js';

import{authenticate} from '../middleware/authMiddleware.js';

const router=express.Router();

router.post("/:id/deploy",
    authenticate,
    createDeployment
);

export default router;