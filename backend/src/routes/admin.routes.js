import { Router } from 'express';
import { getAllSiswa, updateSiswa, getSiswaBelumAbsen, getAllHistory, updateHistoryStatus, deleteHistory, createHistory, getActionToday, createOrUpdateAction, getTodayRecap, sendWhatsAppMessage, getStudentAnalysis, getStudentStatistics } from '../controllers/admin.controllers.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

// All admin routes require authentication and admin role
router.get('/siswa', authenticateToken, requireAdmin, getAllSiswa);
router.get('/siswa/belum-absen', authenticateToken, requireAdmin, getSiswaBelumAbsen);
router.post('/siswa/update', authenticateToken, requireAdmin, updateSiswa);
router.get('/history', authenticateToken, requireAdmin, getAllHistory);
router.post('/history', authenticateToken, requireAdmin, createHistory);
router.put('/history/:id/status', authenticateToken, requireAdmin, updateHistoryStatus);
router.delete('/history/:id', authenticateToken, requireAdmin, deleteHistory);
router.get('/action', authenticateToken, requireAdmin, getActionToday);
router.post('/action', authenticateToken, requireAdmin, createOrUpdateAction);
router.put('/action', authenticateToken, requireAdmin, createOrUpdateAction);
router.get('/recap/today', authenticateToken, requireAdmin, getTodayRecap);
router.get('/analysis/students', authenticateToken, requireAdmin, getStudentAnalysis);
router.get('/statistics/student/:nis', authenticateToken, requireAdmin, getStudentStatistics);
router.post('/whatsapp/send', authenticateToken, requireAdmin, sendWhatsAppMessage);

export default router;

