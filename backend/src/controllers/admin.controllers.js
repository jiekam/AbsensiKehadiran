import { supabase } from '../config/supabase.js';

// Use global fetch (available in Node.js 18+)
// Railway uses Node.js 18+, so we can use native fetch
// No need for node-fetch dependency

// Get all siswa data
export const getAllSiswa = async (req, res) => {
    try {
        const { data: siswa, error } = await supabase
            .from('siswa_xirpl')
            .select('id, nama, nis, rfid, role, password')
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching siswa:', error);
            return res.status(500).json({ message: 'Gagal mengambil data siswa' });
        }

        return res.json({
            message: 'Data siswa berhasil diambil',
            siswa: siswa || []
        });
    } catch (error) {
        console.error('Get all siswa error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

// Get siswa who haven't absen yet for a specific date
export const getSiswaBelumAbsen = async (req, res) => {
    try {
        const { tanggal } = req.query;

        if (!tanggal) {
            return res.status(400).json({ message: 'Parameter tanggal diperlukan' });
        }

        // Get all siswa
        const { data: allSiswa, error: siswaError } = await supabase
            .from('siswa_xirpl')
            .select('id, nama, nis, rfid')
            .order('nama', { ascending: true });

        if (siswaError) {
            console.error('Error fetching siswa:', siswaError);
            return res.status(500).json({ message: 'Gagal mengambil data siswa' });
        }

        // Get history for the selected date
        const { data: history, error: historyError } = await supabase
            .from('history')
            .select('nis, rfid')
            .eq('tanggal', tanggal);

        if (historyError) {
            console.error('Error fetching history:', historyError);
            return res.status(500).json({ message: 'Gagal mengambil data history' });
        }

        // Create a set of students who already have history for this date
        const sudahAbsen = new Set();
        if (history && history.length > 0) {
            history.forEach(record => {
                const key = `${record.nis}-${record.rfid || ''}`;
                sudahAbsen.add(key);
            });
        }

        // Filter out students who already have history
        const belumAbsen = (allSiswa || []).filter(siswa => {
            const key = `${siswa.nis}-${siswa.rfid || ''}`;
            return !sudahAbsen.has(key);
        });

        return res.json({
            message: 'Data siswa belum absen berhasil diambil',
            siswa: belumAbsen
        });
    } catch (error) {
        console.error('Get siswa belum absen error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

// Update siswa data
export const updateSiswa = async (req, res) => {
    try {
        const { siswa } = req.body;

        if (!siswa || !Array.isArray(siswa) || siswa.length === 0) {
            return res.status(400).json({ message: 'Data siswa tidak valid' });
        }

        const updatePromises = siswa.map(async (item) => {
            const { id, nama, nis, rfid, role, password } = item;

            if (!id) {
                throw new Error('ID siswa tidak boleh kosong');
            }

            const updateData = {};
            if (nama !== undefined) updateData.nama = nama;
            if (nis !== undefined) updateData.nis = nis;
            if (rfid !== undefined) updateData.rfid = rfid;
            if (role !== undefined) updateData.role = role;
            if (password !== undefined) updateData.password = password;

            const { error } = await supabase
                .from('siswa_xirpl')
                .update(updateData)
                .eq('id', id);

            if (error) {
                console.error(`Error updating siswa ${id}:`, error);
                throw new Error(`Gagal memperbarui data siswa dengan ID ${id}`);
            }

            return id;
        });

        await Promise.all(updatePromises);

        return res.json({
            message: 'Data siswa berhasil diperbarui',
            updated: siswa.length
        });
    } catch (error) {
        console.error('Update siswa error:', error);
        return res.status(500).json({ 
            message: error.message || 'Terjadi kesalahan saat memperbarui data siswa' 
        });
    }
};

// Get all history data (admin)
export const getAllHistory = async (req, res) => {
    try {
        const { bulan, tanggal } = req.query; // bulan: YYYY-MM, tanggal: YYYY-MM-DD

        // Get all history records - include nama and role directly from history table
        let historyQuery = supabase
            .from('history')
            .select('id, waktu, tanggal, status, rfid, nis, nama, role')
            .order('tanggal', { ascending: false })
            .order('waktu', { ascending: false });

        // Filter by date if provided (prioritas lebih tinggi)
        if (tanggal) {
            historyQuery = historyQuery.eq('tanggal', tanggal);
        } else if (bulan) {
            // Filter by month if no specific date
            const [year, month] = bulan.split('-');
            const startDate = `${year}-${month}-01`;
            const endDate = `${year}-${month}-31`;
            historyQuery = historyQuery.gte('tanggal', startDate).lte('tanggal', endDate);
        }

        const { data: history, error: historyError } = await historyQuery;

        if (historyError) {
            console.error('Error fetching history:', historyError);
            return res.status(500).json({ message: 'Gagal mengambil data history' });
        }

        if (!history || history.length === 0) {
            return res.json({
                message: 'Data history berhasil diambil',
                history: []
            });
        }

        // Get siswa_id from siswa_xirpl for all records
        // Get unique NIS from all history records
        const uniqueNis = [...new Set(history.map(h => h.nis).filter(nis => nis))];
        
        // Fetch siswa data to get siswa_id
        const siswaPromises = uniqueNis.map(async (nis) => {
            const { data: siswa } = await supabase
                .from('siswa_xirpl')
                .select('id, nama, role, rfid, nis')
                .eq('nis', nis)
                .limit(1);
            return { nis, siswa: siswa?.[0] || null };
        });

        const siswaResults = await Promise.all(siswaPromises);
        const siswaMap = {};
        siswaResults.forEach(({ nis, siswa }) => {
            if (siswa) {
                siswaMap[nis] = siswa;
            }
        });

        // Transform history data to include siswa_id and fill null nama/role
        const transformedHistory = history.map(record => {
            const siswa = siswaMap[record.nis];
            
            return {
                id: siswa?.id || record.id, // Use siswa_id for display, fallback to history_id
                history_id: record.id, // Keep history_id for update/delete operations
                siswa_id: siswa?.id || null, // Explicit siswa_id field
                waktu: record.waktu,
                tanggal: record.tanggal,
                status: record.status,
                rfid: record.rfid,
                nis: record.nis,
                nama: record.nama || siswa?.nama || null,
                role: record.role || siswa?.role || null
            };
        });

        return res.json({
            message: 'Data history berhasil diambil',
            history: transformedHistory
        });
    } catch (error) {
        console.error('Get all history error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

// Update history status
export const updateHistoryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['Hadir', 'Sakit', 'Izin', 'Alpha'].includes(status)) {
            return res.status(400).json({ message: 'Status tidak valid' });
        }

        const { error } = await supabase
            .from('history')
            .update({ status })
            .eq('id', id);

        if (error) {
            console.error(`Error updating history ${id}:`, error);
            return res.status(500).json({ message: 'Gagal memperbarui status' });
        }

        return res.json({
            message: 'Status berhasil diperbarui'
        });
    } catch (error) {
        console.error('Update history status error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui status' });
    }
};

// Delete history record
export const deleteHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('history')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Error deleting history ${id}:`, error);
            return res.status(500).json({ message: 'Gagal menghapus data' });
        }

        return res.json({
            message: 'Data berhasil dihapus'
        });
    } catch (error) {
        console.error('Delete history error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan saat menghapus data' });
    }
};

// Create new history record (manual absen)
export const createHistory = async (req, res) => {
    try {
        const { nis, rfid, tanggal, status } = req.body;

        if (!nis || !tanggal || !status) {
            return res.status(400).json({ message: 'NIS, tanggal, dan status diperlukan' });
        }

        if (!['Hadir', 'Sakit', 'Izin', 'Alpha'].includes(status)) {
            return res.status(400).json({ message: 'Status tidak valid' });
        }

        // Get student data from siswa_xirpl table
        const { data: siswa, error: siswaError } = await supabase
            .from('siswa_xirpl')
            .select('id, nama, nis, rfid, role')
            .eq('nis', nis)
            .single();

        if (siswaError || !siswa) {
            console.error('Error fetching siswa:', siswaError);
            return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
        }

        // Use rfid from request if provided, otherwise use from siswa data
        const finalRfid = (rfid && rfid.trim() !== '') ? rfid : (siswa.rfid || null);

        // Get current time in HH:MM:SS format (matching database format)
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const waktu = `${hours}:${minutes}:${seconds}`; // HH:MM:SS format

        // Check if history already exists for this student on this date
        const { data: existingHistory, error: checkError } = await supabase
            .from('history')
            .select('id')
            .eq('nis', nis)
            .eq('tanggal', tanggal)
            .limit(1);

        if (checkError) {
            console.error('Error checking existing history:', checkError);
            return res.status(500).json({ message: 'Gagal memeriksa data history' });
        }

        if (existingHistory && existingHistory.length > 0) {
            return res.status(400).json({ message: 'Siswa ini sudah memiliki absen untuk tanggal ini' });
        }

        // Insert new history record to Supabase with nama, role, and rfid from siswa_xirpl
        const insertData = {
            nis: siswa.nis,
            nama: siswa.nama || null,
            role: siswa.role || null,
            rfid: finalRfid,
            tanggal: tanggal,
            waktu: waktu,
            status: status
        };

        console.log('Inserting history to Supabase:', insertData);

        const { data: newHistory, error: insertError } = await supabase
            .from('history')
            .insert(insertData)
            .select()
            .single();

        if (insertError) {
            console.error('Error creating history in Supabase:', insertError);
            return res.status(500).json({ 
                message: 'Gagal menambahkan absen ke database',
                error: insertError.message 
            });
        }

        console.log('History successfully inserted to Supabase:', newHistory);

        return res.json({
            message: 'Absen berhasil ditambahkan ke database',
            history: newHistory
        });
    } catch (error) {
        console.error('Create history error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan saat menambahkan absen' });
    }
};

// Get action data for today
export const getActionToday = async (req, res) => {
    try {
        // Get current date in YYYY-MM-DD format (WIB/Asia/Jakarta timezone)
        // Convert to WIB (UTC+7)
        const now = new Date();
        const wibOffset = 7 * 60; // WIB is UTC+7
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const wibTime = new Date(utc + (wibOffset * 60000));
        const today = wibTime.toISOString().split('T')[0];

        let { data: action, error } = await supabase
            .from('action')
            .select('*')
            .eq('tanggal', today)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching action:', error);
            return res.status(500).json({ message: 'Gagal mengambil data action' });
        }

        // If no action record exists for today, create one with status "Active"
        if (!action) {
            console.log(`No action record found for today (${today}), creating new record with status "Active"...`);
            
            const { data: newAction, error: createError } = await supabase
                .from('action')
                .insert({
                    nama: 'absensi',
                    tanggal: today,
                    status: 'Active'
                })
                .select()
                .single();

            if (createError) {
                console.error('Error creating action record:', createError);
                return res.status(500).json({ 
                    message: 'Gagal membuat data action',
                    error: createError.message 
                });
            } else {
                console.log('Successfully created action record for today:', newAction);
                action = newAction;
            }
        }

        return res.json({
            message: 'Data action berhasil diambil',
            action: action || null
        });
    } catch (error) {
        console.error('Get action today error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

// Create or update action for today
export const createOrUpdateAction = async (req, res) => {
    try {
        const { nama, status } = req.body;
        // Get current date in YYYY-MM-DD format (WIB/Asia/Jakarta timezone)
        // Convert to WIB (UTC+7)
        const now = new Date();
        const wibOffset = 7 * 60; // WIB is UTC+7
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const wibTime = new Date(utc + (wibOffset * 60000));
        const today = wibTime.toISOString().split('T')[0];

        if (!status || !['Active', 'NonActive'].includes(status)) {
            return res.status(400).json({ message: 'Status tidak valid' });
        }

        // Check if action exists for today
        const { data: existingAction, error: checkError } = await supabase
            .from('action')
            .select('*')
            .eq('tanggal', today)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking action:', checkError);
            return res.status(500).json({ message: 'Gagal memeriksa data action' });
        }

        if (existingAction) {
            // Update existing action
            const { data: updatedAction, error: updateError } = await supabase
                .from('action')
                .update({ status })
                .eq('id', existingAction.id)
                .select()
                .single();

            if (updateError) {
                console.error('Error updating action:', updateError);
                return res.status(500).json({ message: 'Gagal memperbarui data action' });
            }

            return res.json({
                message: 'Status action berhasil diperbarui',
                action: updatedAction
            });
        } else {
            // Create new action
            const { data: newAction, error: createError } = await supabase
                .from('action')
                .insert({
                    nama: nama || 'absensi',
                    tanggal: today,
                    status: status
                })
                .select()
                .single();

            if (createError) {
                console.error('Error creating action:', createError);
                return res.status(500).json({ message: 'Gagal membuat data action' });
            }

            return res.json({
                message: 'Data action berhasil dibuat',
                action: newAction
            });
        }
    } catch (error) {
        console.error('Create or update action error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

// Get today's attendance recap
export const getTodayRecap = async (req, res) => {
    try {
        // Get current date in YYYY-MM-DD format (WIB/Asia/Jakarta timezone)
        const now = new Date();
        const wibOffset = 7 * 60; // WIB is UTC+7
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const wibTime = new Date(utc + (wibOffset * 60000));
        const today = wibTime.toISOString().split('T')[0];

        // Get all history records for today
        const { data: history, error: historyError } = await supabase
            .from('history')
            .select('id, waktu, tanggal, status, rfid, nis, nama, role')
            .eq('tanggal', today)
            .order('waktu', { ascending: false });

        if (historyError) {
            console.error('Error fetching today recap:', historyError);
            return res.status(500).json({ message: 'Gagal mengambil data rekap absen' });
        }

        // Group by status
        const recap = {
            tanggal: today,
            total: history?.length || 0,
            hadir: history?.filter(h => h.status === 'Hadir').length || 0,
            sakit: history?.filter(h => h.status === 'Sakit').length || 0,
            izin: history?.filter(h => h.status === 'Izin').length || 0,
            alpha: history?.filter(h => h.status === 'Alpha').length || 0,
            details: history || []
        };

        return res.json({
            message: 'Data rekap absen berhasil diambil',
            recap: recap
        });
    } catch (error) {
        console.error('Get today recap error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

// Send WhatsApp message via Fonnte API
export const sendWhatsAppMessage = async (req, res) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({ message: 'Nomor telepon dan pesan wajib diisi' });
        }

        // Format phone number (remove +, spaces, etc.)
        const formattedPhone = phone.replace(/[^0-9]/g, '');
        
        // Ensure phone starts with country code (Indonesia: 62)
        let finalPhone = formattedPhone;
        if (!formattedPhone.startsWith('62')) {
            // If starts with 0, replace with 62
            if (formattedPhone.startsWith('0')) {
                finalPhone = '62' + formattedPhone.substring(1);
            } else {
                finalPhone = '62' + formattedPhone;
            }
        }

        // Fonnte API endpoint
        const fonnteUrl = 'https://api.fonnte.com/send';
        
        // FIXED: Jangan pernah pakai fallback token di production!
        const fonnteToken = process.env.FONNTE_API_TOKEN;
        
        if (!fonnteToken) {
            console.error('FATAL: FONNTE_API_TOKEN tidak ada di environment variables');
            return res.status(500).json({ 
                message: 'Fonnte API token tidak dikonfigurasi. Pastikan FONNTE_API_TOKEN ada di environment variables Railway.' 
            });
        }

        // Send message via Fonnte API
        // According to Fonnte API documentation: https://api.fonnte.com/send
        // - Authorization: TOKEN (in header)
        // - Body: form data with 'target' and 'message'
        const formData = new URLSearchParams();
        formData.append('target', finalPhone);
        formData.append('message', message);
        
        console.log('Sending WhatsApp message to:', finalPhone);
        console.log('Message length:', message.length);
        console.log('Fonnte URL:', fonnteUrl);
        console.log('Token exists:', !!fonnteToken);
        console.log('Token length:', fonnteToken ? fonnteToken.length : 0);
        
        let response;
        try {
            // Use global fetch (Node.js 18+)
            // Railway uses Node.js 18+, so native fetch is available
            if (typeof fetch === 'undefined') {
                throw new Error('fetch is not available. Railway requires Node.js 18+ which has native fetch support.');
            }
            response = await fetch(fonnteUrl, {
                method: 'POST',
                headers: {
                    'Authorization': fonnteToken,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });
            console.log('Fetch completed. Status:', response.status, response.statusText);
        } catch (fetchError) {
            console.error('Fetch error:', fetchError);
            console.error('Fetch error name:', fetchError.name);
            console.error('Fetch error message:', fetchError.message);
            console.error('Fetch error stack:', fetchError.stack);
            throw new Error(`Gagal menghubungi Fonnte API: ${fetchError.message}`);
        }

        // Try to parse response as JSON, but handle non-JSON responses
        let responseData;
        const responseText = await response.text();
        
        try {
            responseData = JSON.parse(responseText);
        } catch (parseError) {
            // If response is not JSON, treat it as text
            console.log('Fonnte API response (non-JSON):', responseText);
            responseData = { 
                status: response.ok ? 'success' : 'error',
                message: responseText || 'Unknown response',
                raw: responseText
            };
        }

        console.log('Fonnte API response:', responseData);

        // Check if Fonnte API returned an error
        if (!response.ok || (responseData.status === false || responseData.status === 'false')) {
            console.error('Fonnte API error:', responseData);
            return res.status(response.status || 500).json({ 
                message: 'Gagal mengirim pesan WhatsApp',
                error: responseData.reason || responseData.message || responseData.raw || 'Unknown error from Fonnte API'
            });
        }

        return res.json({
            message: 'Pesan WhatsApp berhasil dikirim',
            data: responseData
        });
    } catch (error) {
        console.error('Send WhatsApp message error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        
        // Return detailed error for debugging (in production, you might want to hide this)
        return res.status(500).json({ 
            message: 'Terjadi kesalahan pada server',
            error: error.message || 'Unknown error',
            details: process.env.NODE_ENV === 'development' ? {
                name: error.name,
                stack: error.stack
            } : undefined
        });
    }
};

