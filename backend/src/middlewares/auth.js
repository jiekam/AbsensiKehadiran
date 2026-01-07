import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { supabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '..', '.env') });
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token tidak ditemukan' });
    }

    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined in environment variables');
        return res.status(500).json({ message: 'Konfigurasi server tidak lengkap' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('JWT verification error:', error.message);
        return res.status(403).json({ 
            message: 'Token tidak valid atau telah kedaluwarsa. Silakan login kembali.' 
        });
    }
};

// Middleware to check if user is admin
export const requireAdmin = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // Get user data from Supabase
        const { data: siswa, error } = await supabase
            .from('siswa_xirpl')
            .select('role')
            .eq('id', userId)
            .single();

        if (error || !siswa) {
            return res.status(404).json({ message: 'Data user tidak ditemukan' });
        }

        if (!siswa.role || siswa.role.toLowerCase() !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak. Hanya admin yang dapat mengakses fitur ini.' });
        }

        next();
    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan saat memverifikasi akses admin' });
    }
};

