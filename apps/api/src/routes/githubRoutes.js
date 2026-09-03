import express from 'express';
import { githubCallback, getRepositories} from '../controllers/githubController';
import { authenticate } from '../middleware/authMiddleware';

const router=express.Router();

router.get("/callback",githubCallback);
router.get("/repositories",
    authenticate,
    getRepositories);
export default router;