window.loadStatistikSiswa = loadStatistikSiswa;
window.showStudentStatistics = showStudentStatistics;

// ==================== PENDAFTARAN RFID FUNCTIONS ====================

// Load latest RFID from kartu_tidak_terdaftar
async function loadLatestRfid() {
    const loadingCell = document.getElementById('rfidLoadingCell');
    const rfidInfo = document.getElementById('rfidInfo');
    const noRfidMessage = document.getElementById('noRfidMessage');
    const latestRfidNumber = document.getElementById('latestRfidNumber');
    const latestRfidTime = document.getElementById('latestRfidTime');
    const daftarRfidInput = document.getElementById('daftarRfidInput');

    if (loadingCell) loadingCell.style.display = 'flex';
    if (rfidInfo) rfidInfo.style.display = 'none';
    if (noRfidMessage) noRfidMessage.style.display = 'none';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/admin/rfid-terbaru`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Gagal mengambil RFID terbaru');

        const data = await response.json();
        
        if (loadingCell) loadingCell.style.display = 'none';

        if (data.rfid) {
            if (rfidInfo) rfidInfo.style.display = 'block';
            if (latestRfidNumber) latestRfidNumber.textContent = data.rfid.rfid;
            if (latestRfidTime) {
                const waktu = convertUTCToWIB(data.rfid.waktu);
                latestRfidTime.textContent = `Ditemukan pada: ${data.rfid.tanggal} ${waktu}`;
            }
            if (daftarRfidInput) daftarRfidInput.value = data.rfid.rfid;
        } else {
            if (noRfidMessage) noRfidMessage.style.display = 'block';
            if (daftarRfidInput) daftarRfidInput.value = '';
        }
    } catch (error) {
        console.error('Error loading latest RFID:', error);
        if (loadingCell) {
            loadingCell.innerHTML = `<p style="color: var(--danger);">${error.message}</p>`;
        }
    }
}

// Load students for registration dropdown
async function loadStudentsForRegistration() {
    const select = document.getElementById('daftarSiswaSelect');
    if (!select) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/admin/siswa`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Gagal mengambil data siswa');

        const data = await response.json();
        const students = data.siswa || [];

        select.innerHTML = '<option value="">-- Pilih Siswa --</option>';
        students.forEach(siswa => {
            const option = document.createElement('option');
            option.value = siswa.nis;
            option.textContent = `${siswa.nama} (${siswa.nis})${siswa.rfid ? ' - Sudah ada RFID' : ''}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading students for registration:', error);
        select.innerHTML = '<option value="">Gagal memuat data siswa</option>';
    }
}

// Handle registration form submission
async function handlePendaftaranSubmit(e) {
    e.preventDefault();
    
    const nis = document.getElementById('daftarSiswaSelect').value;
    const rfid = document.getElementById('daftarRfidInput').value;
    const submitBtn = document.getElementById('submitPendaftaranBtn');

    if (!nis || !rfid) {
        showToast('Silakan pilih siswa dan pastikan RFID terisi', 'error');
        return;
    }

    showLoading('Mendaftarkan kartu...');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/admin/daftar-rfid`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nis, rfid })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Gagal mendaftarkan kartu');
        }

        showToast(data.message, 'success');
        
        // Reset form and refresh data
        document.getElementById('pendaftaranForm').reset();
        loadLatestRfid();
        loadStudentsForRegistration();
    } catch (error) {
        console.error('Error during registration:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
        if (submitBtn) submitBtn.disabled = false;
    }
}

// Make functions available globally
window.loadLatestRfid = loadLatestRfid;
window.loadStudentsForRegistration = loadStudentsForRegistration;
window.handlePendaftaranSubmit = handlePendaftaranSubmit;
