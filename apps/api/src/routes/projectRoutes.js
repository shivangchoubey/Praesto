import express from 'express';
import { createProject, getProjects, getProject , updateProject, deleteProject} from '../controllers/projectController';

const router=express.Router();

router.post('/',createProject);
router.get('/',getProjects);
router.get('/:id',getProject);
router.patch('/:id',updateProject);
router.delete('/:id',deleteProject);

export default router;