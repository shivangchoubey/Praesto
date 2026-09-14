import express from 'express';
import { createProject, getProjects, getProject , updateProject, deleteProject} from '../controllers/projectController';
import { createDeployment } from '../controllers/deploymentController';
import { authenticate } from '../middleware/authMiddleware';

const router=express.Router();

router.post('/',authenticate,createProject);
router.get('/',authenticate,getProjects);
router.get('/:id',authenticate,getProject);
router.patch('/:id',authenticate,updateProject);
router.delete('/:id',authenticate,deleteProject);

router.post("/:id/deploy",authenticate,createDeployment);
export default router;