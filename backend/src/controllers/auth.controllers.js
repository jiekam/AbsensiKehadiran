import JWT from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

export const login = async (req, res) => {
    try {
        const { nama, nis } = req.body;

        if (!nama || !nis) {
            return res.status(400).json({ message : 'Nama dan NIS wajib diisi' });
        }

        const { data: siswa, error } = await supabase
            .from('siswa_xirpl')
            .select('*')
            .eq('nama', nama)
            .eq('nis', nis)
            .single();

        if (error || !siswa) {
            return res.status(401).json({ message : 'Nama atau NIS salah' });
        }

        // Check if JWT_SECRET is set
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not defined in environment variables');
            return res.status(500).json({ message: 'Konfigurasi server tidak lengkap' });
        }

        // token
        const token = JWT.sign(
            {
                id: siswa.id,
                nama: siswa.nama,
                nis: siswa.nis
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        return res.json({
            message: 'Login berhasil',
            token,
            siswa,
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};