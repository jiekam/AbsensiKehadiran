import { Router } from 'express';
import { getDashboard, getHistoryPerBulan, getAnalytics } from '../controllers/dashboard.controllers.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticateToken, getDashboard);
router.get('/history', authenticateToken, getHistoryPerBulan);
router.get('/analytics', authenticateToken, getAnalytics);

export default router;

