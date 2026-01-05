import { Router } from 'express';
import { createAbsen, listAbsen } from '../controllers/absen.controllers.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();
router.post("/create", authenticateToken, createAbsen);
router.get("/", authenticateToken, listAbsen);

export default router;