import { supabase } from '../config/supabase.js';

export const getDashboard = async (req, res) => {
    try {
        // Get user from token (set by auth middleware)
        const userId = req.user.id;
        
        // Get current date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Get logged in user data
        const { data: siswa, error: siswaError } = await supabase
            .from('siswa_xirpl')
            .select('id, nama, nis, rfid, role')
            .eq('id', userId)
            .single();

        if (siswaError || !siswa) {
            console.error('Error fetching siswa:', siswaError);
            return res.status(404).json({ message: 'Data user tidak ditemukan' });
        }

        // Get today's action records to check machine status
        const { data: actions, error: actionError } = await supabase
            .from('action')
            .select('*')
            .eq('tanggal', today);

        if (actionError) {
            console.error('Error fetching actions:', actionError);
            return res.status(500).json({ message: 'Gagal mengambil data mesin' });
        }

        // Check machine status: if there's an Active record for today, machine is Active
        const machineStatus = actions && actions.length > 0 && 
            actions.some(action => action.status === 'Active') 
            ? 'Active' 
            : 'NonActive';

        // Check if user has absen today in history table
        // Note: Assuming history table has 'rfid', 'nis', 'tanggal', 'waktu', and 'status' columns
        const { data: history, error: historyError } = await supabase
            .from('history')
            .select('*')
            .eq('rfid', siswa.rfid)
            .eq('nis', siswa.nis)
            .eq('tanggal', today)
            .order('waktu', { ascending: false })
            .limit(1);

        if (historyError) {
            console.error('Error fetching history:', historyError);
        }

        // Determine absen status
        let absenStatusType = null;
        let absenWaktu = null;

        if (history && history.length > 0) {
            // User has absen today, get status from history
            const historyRecord = history[0];
            absenWaktu = historyRecord.waktu || null;
            const statusFromHistory = historyRecord.status || 'Hadir';
            
            // Map status: Hadir, Sakit, Izin, Alpha
            if (statusFromHistory === 'Hadir' || statusFromHistory === 'Sakit' || 
                statusFromHistory === 'Izin' || statusFromHistory === 'Alpha') {
                absenStatusType = statusFromHistory;
            } else {
                // If status is not one of the expected values, default to Hadir
                absenStatusType = 'Hadir';
            }
        } else {
            // No history record
            // Check if machine is not Active = Alpha
            if (machineStatus !== 'Active') {
                absenStatusType = 'Alpha';
            } else {
                // Machine is Active but no history = not absen yet
                absenStatusType = null;
            }
        }

        return res.json({
            message: 'Data dashboard berhasil diambil',
            user: {
                id: siswa.id,
                nama: siswa.nama,
                nis: siswa.nis,
                rfid: siswa.rfid,
                role: siswa.role
            },
            machineStatus: machineStatus,
            absenStatus: absenStatusType,
            absenWaktu: absenWaktu,
            tanggal: today
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

