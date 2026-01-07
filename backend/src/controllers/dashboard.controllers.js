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

        // Check if RFID is registered
        const hasRfid = siswa.rfid && siswa.rfid.trim() !== '';

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

        // Only check history if RFID is registered
        let absenStatusType = null;
        let absenWaktu = null;

        if (hasRfid) {
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
            if (history && history.length > 0) {
                // User has absen today, get status from history
                const historyRecord = history[0];
                absenWaktu = historyRecord.waktu || null;
                const statusFromHistory = historyRecord.status;
                
                // Map status: Hadir, Sakit, Izin, Alpha
                if (statusFromHistory === 'Hadir' || statusFromHistory === 'Sakit' || 
                    statusFromHistory === 'Izin' || statusFromHistory === 'Alpha') {
                    absenStatusType = statusFromHistory;
                } else {
                    // If status is not one of the expected values, default to null (unknown/belum absen)
                    absenStatusType = null;
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
            hasRfid: hasRfid,
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

export const getHistoryPerBulan = async (req, res) => {
    try {
        // Get user from token (set by auth middleware)
        const userId = req.user.id;

        // Get logged in user data
        const { data: siswa, error: siswaError } = await supabase
            .from('siswa_xirpl')
            .select('id, nama, nis, rfid')
            .eq('id', userId)
            .single();

        if (siswaError || !siswa) {
            console.error('Error fetching siswa:', siswaError);
            return res.status(404).json({ message: 'Data user tidak ditemukan' });
        }

        // Check if RFID is registered
        if (!siswa.rfid || siswa.rfid.trim() === '') {
            return res.status(400).json({ message: 'RFID belum terdaftar' });
        }

        // Get all history records for this user
        const { data: history, error: historyError } = await supabase
            .from('history')
            .select('id, tanggal, waktu, status')
            .eq('rfid', siswa.rfid)
            .eq('nis', siswa.nis)
            .order('tanggal', { ascending: false })
            .order('waktu', { ascending: false });

        if (historyError) {
            console.error('Error fetching history:', historyError);
            return res.status(500).json({ message: 'Gagal mengambil data history' });
        }

        // Group history by month
        const historyPerBulan = {};
        
        if (history && history.length > 0) {
            history.forEach((record) => {
                const date = new Date(record.tanggal);
                const bulan = date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                const bulanKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (!historyPerBulan[bulanKey]) {
                    historyPerBulan[bulanKey] = {
                        bulan: bulan,
                        bulanKey: bulanKey,
                        records: []
                    };
                }
                
                // Add record (will be sorted later)
                historyPerBulan[bulanKey].records.push({
                    tanggal: record.tanggal,
                    waktu: record.waktu,
                    status: record.status
                });
            });
        }

        // Sort records within each month by tanggal and waktu (newest first), then assign ID per bulan
        Object.keys(historyPerBulan).forEach((bulanKey) => {
            historyPerBulan[bulanKey].records.sort((a, b) => {
                const dateA = new Date(`${a.tanggal} ${a.waktu || '00:00:00'}`);
                const dateB = new Date(`${b.tanggal} ${b.waktu || '00:00:00'}`);
                return dateB - dateA; // Descending (newest first)
            });
            
            // Assign ID per bulan starting from 1 (for newest record)
            historyPerBulan[bulanKey].records = historyPerBulan[bulanKey].records.map((record, index) => ({
                id: index + 1,
                tanggal: record.tanggal,
                waktu: record.waktu,
                status: record.status
            }));
        });

        // Convert to array and sort by bulanKey (newest first)
        const historyArray = Object.values(historyPerBulan).sort((a, b) => {
            return b.bulanKey.localeCompare(a.bulanKey);
        });

        // Get list of available months
        const availableMonths = historyArray.map(month => ({
            bulan: month.bulan,
            bulanKey: month.bulanKey
        }));

        // Get selected month from query parameter
        const selectedMonth = req.query.bulan || null;

        // If specific month is requested, filter to that month only
        let filteredHistory = historyArray;
        if (selectedMonth) {
            filteredHistory = historyArray.filter(month => month.bulanKey === selectedMonth);
        }

        return res.json({
            message: 'Data history berhasil diambil',
            history: filteredHistory,
            availableMonths: availableMonths,
            selectedMonth: selectedMonth
        });
    } catch (error) {
        console.error('History error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

export const getAnalytics = async (req, res) => {
    try {
        // Get user from token (set by auth middleware)
        const userId = req.user.id;

        // Get logged in user data
        const { data: siswa, error: siswaError } = await supabase
            .from('siswa_xirpl')
            .select('id, nama, nis, rfid')
            .eq('id', userId)
            .single();

        if (siswaError || !siswa) {
            console.error('Error fetching siswa:', siswaError);
            return res.status(404).json({ message: 'Data user tidak ditemukan' });
        }

        // Check if RFID is registered
        if (!siswa.rfid || siswa.rfid.trim() === '') {
            return res.status(400).json({ message: 'RFID belum terdaftar' });
        }

        // Get all history records for this user
        const { data: history, error: historyError } = await supabase
            .from('history')
            .select('tanggal, status')
            .eq('rfid', siswa.rfid)
            .eq('nis', siswa.nis)
            .order('tanggal', { ascending: false });

        if (historyError) {
            console.error('Error fetching history:', historyError);
            return res.status(500).json({ message: 'Gagal mengambil data history' });
        }

        // Group by month and count all statuses
        const analyticsPerBulan = {};
        let totalAbsenTercatat = 0; // Hadir + Sakit + Izin
        let totalHadir = 0;
        let totalSakit = 0;
        let totalIzin = 0;
        let totalAlpha = 0;

        if (history && history.length > 0) {
            history.forEach((record) => {
                const date = new Date(record.tanggal);
                const bulanKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const bulan = date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                
                if (!analyticsPerBulan[bulanKey]) {
                    analyticsPerBulan[bulanKey] = {
                        bulan: bulan,
                        bulanKey: bulanKey,
                        hadir: 0,
                        sakit: 0,
                        izin: 0,
                        alpha: 0,
                        absenTercatat: 0 // Hadir + Sakit + Izin
                    };
                }
                
                // Count based on status
                const status = (record.status || '').toLowerCase();
                if (status === 'hadir') {
                    analyticsPerBulan[bulanKey].hadir++;
                    analyticsPerBulan[bulanKey].absenTercatat++;
                    totalHadir++;
                    totalAbsenTercatat++;
                } else if (status === 'sakit') {
                    analyticsPerBulan[bulanKey].sakit++;
                    analyticsPerBulan[bulanKey].absenTercatat++;
                    totalSakit++;
                    totalAbsenTercatat++;
                } else if (status === 'izin') {
                    analyticsPerBulan[bulanKey].izin++;
                    analyticsPerBulan[bulanKey].absenTercatat++;
                    totalIzin++;
                    totalAbsenTercatat++;
                } else if (status === 'alpha') {
                    analyticsPerBulan[bulanKey].alpha++;
                    totalAlpha++;
                }
            });
        }

        // Convert to array and sort by bulanKey (newest first)
        const analyticsArray = Object.values(analyticsPerBulan).sort((a, b) => {
            return b.bulanKey.localeCompare(a.bulanKey);
        });

        return res.json({
            message: 'Data analytics berhasil diambil',
            analytics: analyticsArray,
            total: {
                absenTercatat: totalAbsenTercatat,
                hadir: totalHadir,
                sakit: totalSakit,
                izin: totalIzin,
                alpha: totalAlpha
            }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

