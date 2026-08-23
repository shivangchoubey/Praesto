import express from 'express'
import { createUser, getUser , getUserById} from '../controllers/userController';
const router=express.Router();
router.post("/",createUser);
router.get("/",getUser);
router.get("/:id",getUserById);

export default router;