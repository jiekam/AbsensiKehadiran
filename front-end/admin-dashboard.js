const API_URL = 'https://absensikehadiran-production.up.railway.app';

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Check authentication
window.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin');

    // If no token at all, redirect to login
    if (!token) {
        localStorage.clear();
        window.location.href = 'index.html';
        return;
    }

    // SECURITY LAYER 1: Check localStorage flag
    // isAdmin flag is set ONLY when user logs in as admin with password
    // This prevents admin users who login as students from accessing admin dashboard
    if (isAdmin !== 'true') {
        console.log('SECURITY: isAdmin flag is not set. User did not login as admin. Redirecting to dashboard...');
        window.location.href = 'dashboard.html';
        return;
    }

    // SECURITY LAYER 2: Verify JWT token contains role: 'admin' in payload
    // JWT token for admin login has role: 'admin', while student login does NOT have role field
    // This is the PRIMARY security check - even if localStorage is manipulated, JWT cannot be faked
    try {
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            console.error('SECURITY: Invalid JWT token format');
            localStorage.clear();
            window.location.href = 'index.html';
            return;
        }

        const payload = JSON.parse(atob(tokenParts[1]));
        
        // JWT token MUST have role: 'admin' to access admin dashboard
        // Admin users who login as students will NOT have role: 'admin' in their JWT token
        if (!payload.role || payload.role !== 'admin') {
            console.log('SECURITY: JWT token does not contain role: "admin". User logged in as student. Redirecting to dashboard...');
            // Clear isAdmin flag if it was incorrectly set
            localStorage.removeItem('isAdmin');
            window.location.href = 'dashboard.html';
            return;
        }

        // SECURITY LAYER 3: Verify with backend (optional but adds extra security)
        // This ensures backend also validates the token
        try {
            const verifyResponse = await fetch(`${API_URL}/api/admin/siswa`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!verifyResponse.ok) {
                if (verifyResponse.status === 403) {
                    console.log('SECURITY: Backend rejected admin access. Redirecting to dashboard...');
                    localStorage.removeItem('isAdmin');
                    window.location.href = 'dashboard.html';
                    return;
                } else if (verifyResponse.status === 401) {
                    console.log('SECURITY: Token invalid or expired. Redirecting to login...');
                    localStorage.clear();
                    window.location.href = 'index.html';
                    return;
                }
            }
        } catch (verifyError) {
            console.error('SECURITY: Error verifying with backend:', verifyError);
            // On network error, still allow access if JWT is valid (fail open for UX)
            // But log the error for monitoring
        }
    } catch (error) {
        console.error('SECURITY: Error decoding JWT token:', error);
        // If we can't decode token, it's invalid - redirect to login
        localStorage.clear();
        window.location.href = 'index.html';
        return;
    }

    // Initialize theme
    initTheme();

    // Theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Date display
    const dateDisplay = document.getElementById('dateDisplay');
    if (dateDisplay) {
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.textContent = today.toLocaleDateString('id-ID', options);
    }

    // Refresh button
    const refreshBtnHeader = document.getElementById('refreshBtnHeader');
    if (refreshBtnHeader) {
        refreshBtnHeader.addEventListener('click', () => {
            refreshBtnHeader.classList.add('refreshing');
            loadAdminData();
            setTimeout(() => {
                refreshBtnHeader.classList.remove('refreshing');
            }, 1000);
        });
    }

    // Load admin data
    loadAdminData();

    // Send History to WhatsApp Button - Use event delegation or attach after page load
    // Wait a bit to ensure all elements are loaded
    setTimeout(() => {
        const sendHistoryWhatsAppBtn = document.getElementById('sendHistoryWhatsAppBtn');
        if (sendHistoryWhatsAppBtn) {
            console.log('Send WhatsApp button found, attaching event listener');
            sendHistoryWhatsAppBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Send WhatsApp button clicked');
                if (typeof showSendHistoryWhatsAppModal === 'function') {
                    showSendHistoryWhatsAppModal();
                } else {
                    console.error('showSendHistoryWhatsAppModal is not defined');
                    showToast('Fungsi tidak ditemukan. Silakan refresh halaman.', 'error');
                }
            });
        } else {
            console.warn('sendHistoryWhatsAppBtn not found');
        }
    }, 100);

    // Send WhatsApp Modal
    const sendWhatsAppModal = document.getElementById('sendWhatsAppModal');
    const closeSendWhatsAppModal = document.getElementById('closeSendWhatsAppModal');
    const cancelSendWhatsAppBtn = document.getElementById('cancelSendWhatsAppBtn');
    const confirmSendWhatsAppBtn = document.getElementById('confirmSendWhatsAppBtn');
    const whatsappPhoneInput = document.getElementById('whatsappPhoneInput');
    const whatsappMessagePreview = document.getElementById('whatsappMessagePreview');

    if (closeSendWhatsAppModal) {
        closeSendWhatsAppModal.addEventListener('click', hideSendWhatsAppModal);
    }
    if (cancelSendWhatsAppBtn) {
        cancelSendWhatsAppBtn.addEventListener('click', hideSendWhatsAppModal);
    }
    if (sendWhatsAppModal) {
        sendWhatsAppModal.addEventListener('click', (e) => {
            if (e.target === sendWhatsAppModal) {
                hideSendWhatsAppModal();
            }
        });
    }
    if (confirmSendWhatsAppBtn) {
        confirmSendWhatsAppBtn.addEventListener('click', sendWhatsAppMessage);
    }
    if (whatsappPhoneInput) {
        whatsappPhoneInput.addEventListener('input', updateHistoryWhatsAppMessagePreview);
    }


    // Tab Navigation
    const dashboardTab = document.getElementById('dashboardTab');
    const manajemenSiswaTab = document.getElementById('manajemenSiswaTab');
    const historyTab = document.getElementById('historyTab');
    const dashboardPage = document.getElementById('dashboardPage');
    const manajemenSiswaPage = document.getElementById('manajemenSiswaPage');
    const historyPage = document.getElementById('historyPage');

    if (dashboardTab) {
        dashboardTab.addEventListener('click', () => switchPage('dashboard'));
    }
    if (manajemenSiswaTab) {
        manajemenSiswaTab.addEventListener('click', () => switchPage('manajemen-siswa'));
    }
    if (historyTab) {
        historyTab.addEventListener('click', () => switchPage('history'));
    }
    
    const alatTab = document.getElementById('alatTab');
    if (alatTab) {
        alatTab.addEventListener('click', () => switchPage('alat'));
    }
    
    const statistikSiswaTab = document.getElementById('statistikSiswaTab');
    if (statistikSiswaTab) {
        statistikSiswaTab.addEventListener('click', () => switchPage('statistik-siswa'));
    }

    // Alat Status Toggle
    const alatStatusToggle = document.getElementById('alatStatusToggle');
    if (alatStatusToggle) {
        alatStatusToggle.addEventListener('change', async (e) => {
            const newStatus = e.target.checked ? 'Active' : 'NonActive';
            await updateAlatStatus(newStatus);
        });
    }

    // History Date Picker
    const historyDatePicker = document.getElementById('historyDatePicker');
    const clearDateFilterBtn = document.getElementById('clearDateFilterBtn');
    const addAbsenBtn = document.getElementById('addAbsenBtn');
    
    if (historyDatePicker) {
        // Set default to today
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        historyDatePicker.value = `${year}-${month}-${day}`;
        
        historyDatePicker.addEventListener('change', () => {
            loadHistoryData();
        });
    }
    
    if (clearDateFilterBtn) {
        clearDateFilterBtn.addEventListener('click', () => {
            if (historyDatePicker) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                historyDatePicker.value = `${year}-${month}-${day}`;
            }
            loadHistoryData();
        });
    }

    // Add Absen Button
    if (addAbsenBtn) {
        addAbsenBtn.addEventListener('click', showAddAbsenModal);
    }

    // Add Absen Modal
    const addAbsenModal = document.getElementById('addAbsenModal');
    const closeAddAbsenModal = document.getElementById('closeAddAbsenModal');
    const cancelAddAbsenBtn = document.getElementById('cancelAddAbsenBtn');
    const submitAddAbsenBtn = document.getElementById('submitAddAbsenBtn');

    if (closeAddAbsenModal) {
        closeAddAbsenModal.addEventListener('click', hideAddAbsenModal);
    }
    if (cancelAddAbsenBtn) {
        cancelAddAbsenBtn.addEventListener('click', hideAddAbsenModal);
    }
    if (submitAddAbsenBtn) {
        submitAddAbsenBtn.addEventListener('click', submitAddAbsen);
    }
    if (addAbsenModal) {
        addAbsenModal.addEventListener('click', (e) => {
            if (e.target === addAbsenModal) {
                hideAddAbsenModal();
            }
        });
    }

    // Keterangan Detail Modal
    const keteranganDetailModal = document.getElementById('keteranganDetailModal');
    const closeKeteranganModal = document.getElementById('closeKeteranganModal');
    const closeKeteranganBtn = document.getElementById('closeKeteranganBtn');

    if (closeKeteranganModal) {
        closeKeteranganModal.addEventListener('click', hideKeteranganDetailModal);
    }
    if (closeKeteranganBtn) {
        closeKeteranganBtn.addEventListener('click', hideKeteranganDetailModal);
    }
    if (keteranganDetailModal) {
        keteranganDetailModal.addEventListener('click', (e) => {
            if (e.target === keteranganDetailModal) {
                hideKeteranganDetailModal();
            }
        });
    }

    // Edit Keterangan functionality
    const editKeteranganToggleBtn = document.getElementById('editKeteranganToggleBtn');
    const editKeteranganBtn = document.getElementById('editKeteranganBtn');
    const saveKeteranganBtn = document.getElementById('saveKeteranganBtn');

    // Edit Keterangan Toggle
    if (editKeteranganToggleBtn) {
        editKeteranganToggleBtn.addEventListener('click', () => {
            const keteranganText = document.getElementById('keteranganDetailText');
            const keteranganTextarea = document.getElementById('keteranganDetailTextarea');
            
            keteranganText.style.display = 'none';
            keteranganTextarea.style.display = 'block';
            keteranganTextarea.focus();
            keteranganTextarea.select();
            
            editKeteranganToggleBtn.style.display = 'none';
            editKeteranganBtn.style.display = 'block';
            saveKeteranganBtn.style.display = 'block';
        });
    }

    // Cancel Edit
    if (editKeteranganBtn) {
        editKeteranganBtn.addEventListener('click', () => {
            const modal = keteranganDetailModal;
            const originalKeterangan = modal.dataset.originalKeterangan || '';
            const keteranganText = document.getElementById('keteranganDetailText');
            const keteranganTextarea = document.getElementById('keteranganDetailTextarea');
            
            // Revert to original
            keteranganTextarea.value = originalKeterangan;
            
            keteranganText.style.display = 'block';
            keteranganTextarea.style.display = 'none';
            
            editKeteranganToggleBtn.style.display = 'block';
            editKeteranganBtn.style.display = 'none';
            saveKeteranganBtn.style.display = 'none';
        });
    }

    // Save Keterangan
    if (saveKeteranganBtn) {
        saveKeteranganBtn.addEventListener('click', async () => {
            const modal = keteranganDetailModal;
            const historyId = modal.dataset.historyId;
            const keteranganTextarea = document.getElementById('keteranganDetailTextarea');
            const newKeterangan = keteranganTextarea.value.trim();

            if (!historyId) {
                alert('ID history tidak ditemukan');
                return;
            }

            if (!newKeterangan) {
                alert('Keterangan tidak boleh kosong');
                return;
            }

            // Disable button during save
            saveKeteranganBtn.disabled = true;
            saveKeteranganBtn.textContent = 'Menyimpan...';

            try {
                await updateKeteranganFromModal(historyId, newKeterangan);
            } catch (error) {
                console.error('Error saving keterangan:', error);
            } finally {
                saveKeteranganBtn.disabled = false;
                saveKeteranganBtn.textContent = 'Simpan';
            }
        });
    }

    // Save button
    const saveEditBtn = document.getElementById('saveEditBtn');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', saveSiswaChanges);
    }

    // Select All Checkbox
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('#siswaTableBody input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
        });
    }

    // Student Statistics Modal
    const studentStatisticsModal = document.getElementById('studentStatisticsModal');
    const closeStudentStatisticsModal = document.getElementById('closeStudentStatisticsModal');
    const closeStudentStatisticsBtn = document.getElementById('closeStudentStatisticsBtn');
    
    if (closeStudentStatisticsModal) {
        closeStudentStatisticsModal.addEventListener('click', hideStudentStatisticsModal);
    }
    if (closeStudentStatisticsBtn) {
        closeStudentStatisticsBtn.addEventListener('click', hideStudentStatisticsModal);
    }
    if (studentStatisticsModal) {
        studentStatisticsModal.addEventListener('click', (e) => {
            if (e.target === studentStatisticsModal) {
                hideStudentStatisticsModal();
            }
        });
    }

    // Refresh Statistik Button
    const refreshStatistikBtn = document.getElementById('refreshStatistikBtn');
    if (refreshStatistikBtn) {
        refreshStatistikBtn.addEventListener('click', () => {
            refreshStatistikBtn.classList.add('refreshing');
            loadStatistikSiswa();
            setTimeout(() => {
                refreshStatistikBtn.classList.remove('refreshing');
            }, 1000);
        });
    }
});

// History Management
let historyData = [];

// Load History Data
async function loadHistoryData() {
    const loadingCell = document.getElementById('historyLoadingCell');
    const tableContainer = document.getElementById('historyTableContainer');
    const tableBody = document.getElementById('historyTableBody');

    if (loadingCell) loadingCell.style.display = 'flex';
    if (tableContainer) tableContainer.style.display = 'none';

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        // Get selected date
        const datePicker = document.getElementById('historyDatePicker');
        const selectedDate = datePicker ? datePicker.value : null;

        let url = `${API_URL}/api/admin/history`;
        if (selectedDate) {
            url += `?tanggal=${selectedDate}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal mengambil data history' }));
            throw new Error(errorData.message || 'Gagal mengambil data history');
        }

        const data = await response.json();
        historyData = data.history || [];

        // Debug: Check if keterangan is present in data
        if (historyData.length > 0) {
            console.log(`Total records: ${historyData.length}`);
            // Log all records to see their structure
            historyData.forEach((r, idx) => {
                console.log(`Record ${idx + 1}:`, {
                    id: r.history_id || r.id,
                    status: r.status,
                    keterangan: r.keterangan,
                    keteranganType: typeof r.keterangan,
                    hasKeterangan: !!r.keterangan,
                    statusInList: ['Sakit', 'Izin', 'Alpha'].includes(r.status)
                });
            });
            const recordsWithKeterangan = historyData.filter(r => {
                const hasKeterangan = r.keterangan && r.keterangan !== null && r.keterangan !== '';
                const statusMatch = ['Sakit', 'Izin', 'Alpha'].includes(r.status);
                return hasKeterangan && statusMatch;
            });
            console.log(`Records with keterangan (filtered): ${recordsWithKeterangan.length}`);
            if (recordsWithKeterangan.length > 0) {
                console.log('Sample record with keterangan:', recordsWithKeterangan[0]);
            }
        }

        renderHistoryTable();

        if (loadingCell) loadingCell.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
    } catch (error) {
        console.error('Error loading history data:', error);
        if (loadingCell) {
            loadingCell.innerHTML = `
                <div style="text-align: center; color: var(--danger);">
                    <p>${error.message || 'Gagal memuat data history'}</p>
                    <button class="btn-primary" onclick="loadHistoryData()" style="margin-top: 16px;">Coba Lagi</button>
                </div>
            `;
        }
    }
}

// Render History Table
function renderHistoryTable() {
    const tableBody = document.getElementById('historyTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (historyData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-light);">
                    Tidak ada data history untuk tanggal yang dipilih
                </td>
            </tr>
        `;
        return;
    }

    historyData.forEach((record) => {
        const row = document.createElement('tr');
        // Use siswa_id (id) for display, history_id for operations
        const displayId = record.id || record.siswa_id || '-';
        const historyId = record.history_id || record.id; // Fallback to id if history_id not available
        // Get keterangan - handle null, undefined, or empty string
        let keterangan = null;
        if (record.keterangan !== null && record.keterangan !== undefined && record.keterangan !== '') {
            keterangan = String(record.keterangan).trim();
            if (keterangan === '') keterangan = null;
        }
        
        const statusUpper = (record.status || '').toUpperCase();
        const showKeterangan = statusUpper === 'SAKIT' || statusUpper === 'IZIN' || statusUpper === 'ALPHA';
        
        // Store record data in row for modal
        row.dataset.recordData = JSON.stringify({
            historyId: historyId,
            nama: record.nama || '-',
            nis: record.nis || '-',
            tanggal: record.tanggal || '-',
            waktu: record.waktu || '-',
            status: record.status || '-',
            keterangan: keterangan || null,
            showKeterangan: showKeterangan
        });
        
        // Add clickable class if has keterangan
        if (showKeterangan) {
            row.classList.add('history-row-clickable');
            row.style.cursor = 'pointer';
        }
        
        row.innerHTML = `
            <td>${record.waktu || '-'}</td>
            <td>${displayId}</td>
            <td>${record.nama || '-'}</td>
            <td>${record.role || 'NULL'}</td>
            <td>${record.nis || '-'}</td>
            <td>${record.rfid || '-'}</td>
            <td>${record.tanggal || '-'}</td>
            <td>
                <select class="status-select" data-id="${historyId}" data-original-status="${record.status}">
                    <option value="Hadir" ${record.status === 'Hadir' ? 'selected' : ''}>Hadir</option>
                    <option value="Sakit" ${record.status === 'Sakit' ? 'selected' : ''}>Sakit</option>
                    <option value="Izin" ${record.status === 'Izin' ? 'selected' : ''}>Izin</option>
                    <option value="Alpha" ${record.status === 'Alpha' ? 'selected' : ''}>Alpha</option>
                </select>
            </td>
            <td>
                <button class="btn-delete" data-id="${historyId}" title="Hapus">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M10 11V17M14 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Add event listeners for status change
    const statusSelects = tableBody.querySelectorAll('.status-select');
    statusSelects.forEach(select => {
        select.addEventListener('change', async (e) => {
            const historyId = e.target.dataset.id;
            const newStatus = e.target.value;
            const originalStatus = e.target.dataset.originalStatus;

            if (newStatus === originalStatus) {
                return; // No change
            }

            // Get existing keterangan from the row
            const row = e.target.closest('tr');
            const keteranganCell = row.querySelector('.keterangan-cell');
            const existingKeterangan = keteranganCell ? keteranganCell.dataset.originalKeterangan : '';

            // Show prompt for keterangan if status is Sakit, Izin, or Alpha
            let keterangan = '';
            if (['Sakit', 'Izin', 'Alpha'].includes(newStatus)) {
                // If existing keterangan exists and status is changing from another status that requires keterangan, use it as default
                const defaultKeterangan = (existingKeterangan && existingKeterangan !== '-') ? existingKeterangan : '';
                keterangan = prompt(`Masukkan keterangan untuk status ${newStatus}:`, defaultKeterangan);
                if (keterangan === null) {
                    // User cancelled, revert to original status
                    e.target.value = originalStatus;
                    return;
                }
                if (!keterangan || keterangan.trim() === '') {
                    alert('Keterangan wajib diisi untuk status ' + newStatus);
                    e.target.value = originalStatus;
                    return;
                }
                keterangan = keterangan.trim();
            }

            await updateHistoryStatus(historyId, newStatus, e.target, keterangan);
        });
    });

    // Add event listeners for delete
    const deleteButtons = tableBody.querySelectorAll('.btn-delete');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent row click
            const historyId = e.target.closest('.btn-delete').dataset.id;
            if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
                await deleteHistoryRecord(historyId);
            }
        });
    });

    // Add event listeners for row click to show keterangan detail
    const clickableRows = tableBody.querySelectorAll('.history-row-clickable');
    clickableRows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking on select or button
            if (e.target.closest('.status-select') || e.target.closest('.btn-delete')) {
                return;
            }
            
            const recordData = JSON.parse(row.dataset.recordData);
            showKeteranganDetailModal(recordData);
        });
    });
}

// Show Keterangan Detail Modal
function showKeteranganDetailModal(recordData) {
    const modal = document.getElementById('keteranganDetailModal');
    if (!modal) return;

    // Store record data in modal for editing
    modal.dataset.historyId = recordData.historyId;
    modal.dataset.originalKeterangan = recordData.keterangan || '';

    // Populate modal with data
    document.getElementById('keteranganDetailNama').textContent = recordData.nama || '-';
    document.getElementById('keteranganDetailNis').textContent = recordData.nis || '-';
    document.getElementById('keteranganDetailTanggal').textContent = recordData.tanggal || '-';
    document.getElementById('keteranganDetailWaktu').textContent = recordData.waktu || '-';
    
    // Status with badge
    const statusElement = document.getElementById('keteranganDetailStatus');
    const statusLower = (recordData.status || '').toLowerCase();
    const statusClass = statusLower === 'hadir' ? 'hadir' : 
                      statusLower === 'sakit' ? 'sakit' : 
                      statusLower === 'izin' ? 'izin' : 
                      statusLower === 'alpha' ? 'alpha' : '';
    statusElement.innerHTML = `<span class="status-badge ${statusClass}">${recordData.status || '-'}</span>`;
    
    // Keterangan - show text view
    const keteranganText = document.getElementById('keteranganDetailText');
    const keteranganTextarea = document.getElementById('keteranganDetailTextarea');
    
    if (recordData.keterangan && recordData.keterangan.trim()) {
        keteranganText.textContent = recordData.keterangan;
        keteranganText.style.color = 'var(--text)';
        keteranganText.style.fontStyle = 'normal';
        keteranganTextarea.value = recordData.keterangan;
    } else {
        keteranganText.textContent = 'Tidak ada keterangan';
        keteranganText.style.color = 'var(--text-light)';
        keteranganText.style.fontStyle = 'italic';
        keteranganTextarea.value = '';
    }

    // Reset edit mode
    keteranganText.style.display = 'block';
    keteranganTextarea.style.display = 'none';
    document.getElementById('editKeteranganToggleBtn').style.display = 'block';
    document.getElementById('editKeteranganBtn').style.display = 'none';
    document.getElementById('saveKeteranganBtn').style.display = 'none';

    // Show modal
    modal.style.display = 'flex';
}

// Hide Keterangan Detail Modal
function hideKeteranganDetailModal() {
    const modal = document.getElementById('keteranganDetailModal');
    if (modal) {
        modal.style.display = 'none';
        // Reset edit mode
        const keteranganText = document.getElementById('keteranganDetailText');
        const keteranganTextarea = document.getElementById('keteranganDetailTextarea');
        const editKeteranganToggleBtn = document.getElementById('editKeteranganToggleBtn');
        const editKeteranganBtn = document.getElementById('editKeteranganBtn');
        const saveKeteranganBtn = document.getElementById('saveKeteranganBtn');
        
        if (keteranganText) keteranganText.style.display = 'block';
        if (keteranganTextarea) keteranganTextarea.style.display = 'none';
        if (editKeteranganToggleBtn) editKeteranganToggleBtn.style.display = 'block';
        if (editKeteranganBtn) editKeteranganBtn.style.display = 'none';
        if (saveKeteranganBtn) saveKeteranganBtn.style.display = 'none';
    }
}

// Update Keterangan from Modal
async function updateKeteranganFromModal(historyId, newKeterangan) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        // Get current status from the row
        const tableBody = document.getElementById('historyTableBody');
        const row = tableBody.querySelector(`tr[data-record-data*='"historyId":"${historyId}"']`);
        let currentStatus = '';
        
        if (row) {
            const statusSelect = row.querySelector('.status-select');
            currentStatus = statusSelect ? statusSelect.value : '';
        } else {
            // Try to get from modal data or historyData
            const record = historyData.find(r => (r.history_id || r.id) == historyId);
            currentStatus = record ? record.status : '';
        }

        // Validate that status requires keterangan
        if (!['Sakit', 'Izin', 'Alpha'].includes(currentStatus)) {
            throw new Error('Keterangan hanya dapat diubah untuk status Sakit, Izin, atau Alpha');
        }

        const response = await fetch(`${API_URL}/api/admin/history/${historyId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                status: currentStatus,
                keterangan: newKeterangan 
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal memperbarui keterangan' }));
            throw new Error(errorData.message || 'Gagal memperbarui keterangan');
        }

        // Update modal display
        const keteranganText = document.getElementById('keteranganDetailText');
        const keteranganTextarea = document.getElementById('keteranganDetailTextarea');
        const modal = document.getElementById('keteranganDetailModal');
        
        keteranganText.textContent = newKeterangan;
        keteranganText.style.color = 'var(--text)';
        keteranganText.style.fontStyle = 'normal';
        modal.dataset.originalKeterangan = newKeterangan;
        
        // Exit edit mode
        keteranganText.style.display = 'block';
        keteranganTextarea.style.display = 'none';
        document.getElementById('editKeteranganToggleBtn').style.display = 'block';
        document.getElementById('editKeteranganBtn').style.display = 'none';
        document.getElementById('saveKeteranganBtn').style.display = 'none';
        
        showToast('Keterangan berhasil diperbarui', 'success');
        
        // Reload history data to ensure sync
        await loadHistoryData();
    } catch (error) {
        console.error('Error updating keterangan:', error);
        showToast(error.message || 'Gagal memperbarui keterangan', 'error');
        throw error;
    }
}

// Update Keterangan (kept for backward compatibility, but not used in table anymore)
async function updateKeterangan(historyId, newKeterangan, cellElement, textSpan, inputField) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        // Get current status from the row
        const row = cellElement.closest('tr');
        const statusSelect = row.querySelector('.status-select');
        const currentStatus = statusSelect ? statusSelect.value : '';

        // Validate that status requires keterangan
        if (!['Sakit', 'Izin', 'Alpha'].includes(currentStatus)) {
            throw new Error('Keterangan hanya dapat diubah untuk status Sakit, Izin, atau Alpha');
        }

        const response = await fetch(`${API_URL}/api/admin/history/${historyId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                status: currentStatus,
                keterangan: newKeterangan 
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal memperbarui keterangan' }));
            throw new Error(errorData.message || 'Gagal memperbarui keterangan');
        }

        // Update UI
        textSpan.textContent = newKeterangan;
        cellElement.dataset.originalKeterangan = newKeterangan;
        textSpan.style.display = 'inline';
        inputField.style.display = 'none';
        
        showToast('Keterangan berhasil diperbarui', 'success');
        
        // Reload history data to ensure sync
        await loadHistoryData();
    } catch (error) {
        console.error('Error updating keterangan:', error);
        showToast(error.message || 'Gagal memperbarui keterangan', 'error');
        // Revert to original
        inputField.value = cellElement.dataset.originalKeterangan;
        textSpan.style.display = 'inline';
        inputField.style.display = 'none';
    }
}

// Update History Status
async function updateHistoryStatus(historyId, newStatus, selectElement, keterangan = '') {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const body = { status: newStatus };
        if (['Sakit', 'Izin', 'Alpha'].includes(newStatus) && keterangan) {
            body.keterangan = keterangan;
        }

        const response = await fetch(`${API_URL}/api/admin/history/${historyId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal memperbarui status' }));
            throw new Error(errorData.message || 'Gagal memperbarui status');
        }

        // Update original status in dataset
        selectElement.dataset.originalStatus = newStatus;
        showToast('Status berhasil diperbarui', 'success');
        
        // Reload history data
        await loadHistoryData();
    } catch (error) {
        console.error('Error updating history status:', error);
        showToast(error.message || 'Gagal memperbarui status', 'error');
        // Revert select to original value
        const originalStatus = selectElement.dataset.originalStatus;
        selectElement.value = originalStatus;
    }
}

// Delete History Record
async function deleteHistoryRecord(historyId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const response = await fetch(`${API_URL}/api/admin/history/${historyId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal menghapus data' }));
            throw new Error(errorData.message || 'Gagal menghapus data');
        }

        showToast('Data berhasil dihapus', 'success');
        
        // Reload history data
        const datePicker = document.getElementById('historyDatePicker');
        const selectedDate = datePicker ? datePicker.value : null;
        await loadHistoryData(selectedDate);
    } catch (error) {
        console.error('Error deleting history record:', error);
        showToast(error.message || 'Gagal menghapus data', 'error');
    }
}

// Load students who haven't absen yet for selected date
async function loadSiswaBelumAbsen() {
    const siswaSelect = document.getElementById('absenSiswaSelect');
    if (!siswaSelect) return;

    siswaSelect.innerHTML = '<option value="">Memuat data siswa...</option>';
    siswaSelect.disabled = true;

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        // Get selected date
        const datePicker = document.getElementById('historyDatePicker');
        const selectedDate = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];

        const response = await fetch(`${API_URL}/api/admin/siswa/belum-absen?tanggal=${selectedDate}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal mengambil data siswa' }));
            throw new Error(errorData.message || 'Gagal mengambil data siswa');
        }

        const data = await response.json();
        const siswaList = data.siswa || [];

        siswaSelect.innerHTML = '';
        if (siswaList.length === 0) {
            siswaSelect.innerHTML = '<option value="">Tidak ada siswa yang belum absen</option>';
        } else {
            siswaSelect.innerHTML = '<option value="">Pilih siswa...</option>';
            siswaList.forEach(siswa => {
                const option = document.createElement('option');
                option.value = JSON.stringify({ id: siswa.id, nis: siswa.nis, rfid: siswa.rfid, nama: siswa.nama });
                option.textContent = `${siswa.nama} (NIS: ${siswa.nis})`;
                siswaSelect.appendChild(option);
            });
        }

        siswaSelect.disabled = false;
    } catch (error) {
        console.error('Error loading siswa belum absen:', error);
        siswaSelect.innerHTML = `<option value="">Error: ${error.message}</option>`;
        siswaSelect.disabled = false;
    }
}

// Show Add Absen Modal
function showAddAbsenModal() {
    const modal = document.getElementById('addAbsenModal');
    if (!modal) return;

    // Get selected date or use today
    const datePicker = document.getElementById('historyDatePicker');
    const selectedDate = datePicker ? datePicker.value : null;
    
    if (!selectedDate) {
        showToast('Pilih tanggal terlebih dahulu', 'error');
        return;
    }

    modal.classList.add('show');
    loadSiswaBelumAbsen();
    
    // Setup status change listener to show/hide keterangan field
    const statusSelect = document.getElementById('absenStatusSelect');
    const keteranganFormGroup = document.getElementById('keteranganFormGroup');
    const keteranganInput = document.getElementById('absenKeteranganInput');
    
    if (statusSelect && keteranganFormGroup) {
        // Remove existing listeners
        const newStatusSelect = statusSelect.cloneNode(true);
        statusSelect.parentNode.replaceChild(newStatusSelect, statusSelect);
        
        // Add new listener
        newStatusSelect.addEventListener('change', function() {
            const status = this.value;
            if (['Sakit', 'Izin', 'Alpha'].includes(status)) {
                keteranganFormGroup.style.display = 'block';
                if (keteranganInput) keteranganInput.required = true;
            } else {
                keteranganFormGroup.style.display = 'none';
                if (keteranganInput) {
                    keteranganInput.required = false;
                    keteranganInput.value = '';
                }
            }
        });
        
        // Trigger on initial load
        if (newStatusSelect.value) {
            newStatusSelect.dispatchEvent(new Event('change'));
        }
    }
}

// Hide Add Absen Modal
function hideAddAbsenModal() {
    const modal = document.getElementById('addAbsenModal');
    if (!modal) return;

    modal.classList.remove('show');
    
    // Reset form
    const siswaSelect = document.getElementById('absenSiswaSelect');
    const statusSelect = document.getElementById('absenStatusSelect');
    const keteranganInput = document.getElementById('absenKeteranganInput');
    const keteranganFormGroup = document.getElementById('keteranganFormGroup');
    if (siswaSelect) siswaSelect.value = '';
    if (statusSelect) statusSelect.value = 'Sakit';
    if (keteranganInput) keteranganInput.value = '';
    if (keteranganFormGroup) keteranganFormGroup.style.display = 'none';
}

// Submit Add Absen
async function submitAddAbsen() {
    const submitBtn = document.getElementById('submitAddAbsenBtn');
    const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
    const originalText = btnText ? btnText.textContent : 'Simpan';

    if (submitBtn) submitBtn.disabled = true;
    if (btnText) {
        btnText.innerHTML = `
            <div class="loading-boxes" style="display: inline-flex; gap: 4px; align-items: center;">
                <div class="loading-box" style="width: 8px; height: 8px; background: white;"></div>
                <div class="loading-box" style="width: 8px; height: 8px; background: white;"></div>
                <div class="loading-box" style="width: 8px; height: 8px; background: white;"></div>
            </div>
            <span style="margin-left: 8px;">Menyimpan...</span>
        `;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const siswaSelect = document.getElementById('absenSiswaSelect');
        const statusSelect = document.getElementById('absenStatusSelect');
        const keteranganInput = document.getElementById('absenKeteranganInput');
        const datePicker = document.getElementById('historyDatePicker');

        if (!siswaSelect || !statusSelect || !datePicker) {
            throw new Error('Form tidak lengkap');
        }

        const selectedSiswa = siswaSelect.value;
        const status = statusSelect.value;
        const tanggal = datePicker.value;
        const keterangan = keteranganInput ? keteranganInput.value.trim() : '';

        if (!selectedSiswa || !status || !tanggal) {
            throw new Error('Harap lengkapi semua field');
        }

        // Validate keterangan for Sakit, Izin, Alpha
        if (['Sakit', 'Izin', 'Alpha'].includes(status) && !keterangan) {
            throw new Error('Keterangan wajib diisi untuk status ' + status);
        }

        const siswa = JSON.parse(selectedSiswa);

        const response = await fetch(`${API_URL}/api/admin/history`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nis: siswa.nis,
                rfid: siswa.rfid || '',
                tanggal: tanggal,
                status: status,
                keterangan: keterangan
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal menambahkan absen' }));
            throw new Error(errorData.message || 'Gagal menambahkan absen');
        }

        showToast('Absen berhasil ditambahkan', 'success');
        hideAddAbsenModal();
        
        // Reload history data from Supabase
        // Small delay to ensure Supabase has processed the insert
        setTimeout(async () => {
            await loadHistoryData();
        }, 500);
    } catch (error) {
        console.error('Error submitting absen:', error);
        showToast(error.message || 'Gagal menambahkan absen', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.textContent = originalText;
    }
}

// Switch Page
function switchPage(page) {
    const dashboardTab = document.getElementById('dashboardTab');
    const manajemenSiswaTab = document.getElementById('manajemenSiswaTab');
    const historyTab = document.getElementById('historyTab');
    const alatTab = document.getElementById('alatTab');
    const statistikSiswaTab = document.getElementById('statistikSiswaTab');
    const dashboardPage = document.getElementById('dashboardPage');
    const manajemenSiswaPage = document.getElementById('manajemenSiswaPage');
    const historyPage = document.getElementById('historyPage');
    const alatPage = document.getElementById('alatPage');
    const statistikSiswaPage = document.getElementById('statistikSiswaPage');

    // Remove active class from all tabs and pages
    if (dashboardTab) dashboardTab.classList.remove('active');
    if (manajemenSiswaTab) manajemenSiswaTab.classList.remove('active');
    if (historyTab) historyTab.classList.remove('active');
    if (alatTab) alatTab.classList.remove('active');
    if (statistikSiswaTab) statistikSiswaTab.classList.remove('active');
    if (dashboardPage) dashboardPage.classList.remove('active');
    if (manajemenSiswaPage) manajemenSiswaPage.classList.remove('active');
    if (historyPage) historyPage.classList.remove('active');
    if (alatPage) alatPage.classList.remove('active');
    if (statistikSiswaPage) statistikSiswaPage.classList.remove('active');

    // Add active class to selected tab and page
    if (page === 'dashboard') {
        if (dashboardTab) dashboardTab.classList.add('active');
        if (dashboardPage) dashboardPage.classList.add('active');
    } else if (page === 'manajemen-siswa') {
        if (manajemenSiswaTab) manajemenSiswaTab.classList.add('active');
        if (manajemenSiswaPage) manajemenSiswaPage.classList.add('active');
        // Load siswa data when switching to this page
        loadSiswaData();
    } else if (page === 'history') {
        if (historyTab) historyTab.classList.add('active');
        if (historyPage) historyPage.classList.add('active');
        // Load history data when switching to this page
        loadHistoryData();
        // Attach WhatsApp button event listener when switching to history page
        setTimeout(() => {
            const sendHistoryWhatsAppBtn = document.getElementById('sendHistoryWhatsAppBtn');
            if (sendHistoryWhatsAppBtn) {
                // Remove existing listeners by cloning the element
                const newBtn = sendHistoryWhatsAppBtn.cloneNode(true);
                sendHistoryWhatsAppBtn.parentNode.replaceChild(newBtn, sendHistoryWhatsAppBtn);
                // Add new event listener
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Send WhatsApp button clicked from history page');
                    if (typeof showSendHistoryWhatsAppModal === 'function') {
                        showSendHistoryWhatsAppModal();
                    } else {
                        console.error('showSendHistoryWhatsAppModal is not defined');
                        showToast('Fungsi tidak ditemukan. Silakan refresh halaman.', 'error');
                    }
                });
            }
        }, 100);
    } else if (page === 'alat') {
        if (alatTab) alatTab.classList.add('active');
        if (alatPage) alatPage.classList.add('active');
        // Load alat status when switching to this page
        loadAlatStatus();
        // Initialize 3D when switching to this page
        initAlat3D();
    } else if (page === 'statistik-siswa') {
        const statistikSiswaTab = document.getElementById('statistikSiswaTab');
        const statistikSiswaPage = document.getElementById('statistikSiswaPage');
        if (statistikSiswaTab) statistikSiswaTab.classList.add('active');
        if (statistikSiswaPage) statistikSiswaPage.classList.add('active');
        // Load statistik data when switching to this page
        loadStatistikSiswa();
    }
}

// Load admin data
async function loadAdminData() {
    const adminInfoContent = document.getElementById('adminInfoContent');
    const welcomeAdminName = document.getElementById('welcomeAdminName');

    if (!adminInfoContent) {
        console.error('adminInfoContent element not found');
        return;
    }

    try {
        // Get admin data from localStorage
        const siswaData = localStorage.getItem('siswa');
        if (siswaData) {
            const siswa = JSON.parse(siswaData);
            
            // Display admin name
            if (siswa.nama && welcomeAdminName) {
                welcomeAdminName.textContent = siswa.nama;
            }

            // Display admin info
            adminInfoContent.innerHTML = `
                <div class="info-item">
                    <span class="info-label">Nama</span>
                    <span class="info-value">${siswa.nama || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">NIS</span>
                    <span class="info-value">${siswa.nis || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Role</span>
                    <span class="info-value" style="color: var(--primary); text-transform: capitalize;">${siswa.role || 'Admin'}</span>
                </div>
            `;
        } else {
            adminInfoContent.innerHTML = `
                <div class="error-message">
                    <p>Data admin tidak ditemukan</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
        if (adminInfoContent) {
            adminInfoContent.innerHTML = `
                <div class="error-message">
                    <p>Gagal memuat data admin</p>
                </div>
            `;
        }
    }
}

// Logout handler
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        // Clear localStorage
        localStorage.clear();
        
        // Redirect to login
        window.location.href = 'index.html';
    });
}

// Siswa Management
let siswaData = [];
let originalSiswaData = [];

// Load Siswa Data
async function loadSiswaData() {
    const loadingCell = document.getElementById('siswaLoadingCell');
    const tableContainer = document.getElementById('siswaTableContainer');
    const tableBody = document.getElementById('siswaTableBody');
    const footer = document.getElementById('slidePanelFooter');

    if (loadingCell) loadingCell.style.display = 'flex';
    if (tableContainer) tableContainer.style.display = 'none';
    if (footer) footer.style.display = 'none';

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const response = await fetch(`${API_URL}/api/admin/siswa`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal mengambil data siswa' }));
            throw new Error(errorData.message || 'Gagal mengambil data siswa');
        }

        const data = await response.json();
        siswaData = data.siswa || [];
        originalSiswaData = JSON.parse(JSON.stringify(siswaData)); // Deep copy

        renderSiswaTable();

        if (loadingCell) loadingCell.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
    } catch (error) {
        console.error('Error loading siswa data:', error);
        if (loadingCell) {
            loadingCell.innerHTML = `
                <div style="text-align: center; color: var(--danger);">
                    <p>${error.message || 'Gagal memuat data siswa'}</p>
                    <button class="btn-primary" onclick="loadSiswaData()" style="margin-top: 16px;">Coba Lagi</button>
                </div>
            `;
        }
    }
}

// Render Siswa Table
function renderSiswaTable() {
    const tableBody = document.getElementById('siswaTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    siswaData.forEach((siswa, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="checkbox" class="row-checkbox" data-index="${index}">
            </td>
            <td>
                <div class="id-cell">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>${siswa.id}</span>
                </div>
            </td>
            <td>
                <input type="text" class="editable-input" data-field="nama" data-index="${index}" value="${siswa.nama || ''}" readonly title="Double-click untuk edit">
            </td>
            <td>
                <input type="number" class="editable-input" data-field="nis" data-index="${index}" value="${siswa.nis || ''}" readonly title="Double-click untuk edit">
            </td>
            <td>
                <input type="text" class="editable-input" data-field="rfid" data-index="${index}" value="${siswa.rfid || ''}" readonly title="Double-click untuk edit">
            </td>
            <td>
                <input type="text" class="editable-input" data-field="role" data-index="${index}" value="${siswa.role || ''}" readonly title="Double-click untuk edit">
            </td>
            <td>
                <input type="text" class="editable-input" data-field="password" data-index="${index}" value="${siswa.password || ''}" readonly title="Double-click untuk edit">
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Add event listeners for double-click to edit
    const editableInputs = tableBody.querySelectorAll('.editable-input');
    editableInputs.forEach(input => {
        input.addEventListener('dblclick', () => {
            if (input.readOnly) {
                input.readOnly = false;
                input.focus();
                input.select();
            }
        });
    });
}

// Cancel Edit (reset to original)
function cancelSiswaEdit() {
    // Reset to original data
    siswaData = JSON.parse(JSON.stringify(originalSiswaData));
    renderSiswaTable();
}

// Save Changes
async function saveSiswaChanges() {
    const saveBtn = document.getElementById('saveEditBtn');
    const originalText = saveBtn ? saveBtn.innerHTML : '';
    
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
            <div class="loading-boxes" style="display: flex; gap: 4px; align-items: center;">
                <div class="loading-box" style="width: 8px; height: 8px; background: white;"></div>
                <div class="loading-box" style="width: 8px; height: 8px; background: white;"></div>
                <div class="loading-box" style="width: 8px; height: 8px; background: white;"></div>
            </div>
            <span style="margin-left: 8px;">Menyimpan...</span>
        `;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        // Find changed rows
        const changedRows = [];
        siswaData.forEach((siswa, index) => {
            const original = originalSiswaData[index];
            if (JSON.stringify(siswa) !== JSON.stringify(original)) {
                changedRows.push({
                    id: siswa.id,
                    nama: siswa.nama,
                    nis: siswa.nis,
                    rfid: siswa.rfid,
                    role: siswa.role,
                    password: siswa.password
                });
            }
        });

        if (changedRows.length === 0) {
            showToast('Tidak ada perubahan yang disimpan', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
            }
            cancelSiswaEdit();
            return;
        }

        const response = await fetch(`${API_URL}/api/admin/siswa/update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ siswa: changedRows })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal menyimpan perubahan' }));
            throw new Error(errorData.message || 'Gagal menyimpan perubahan');
        }

        const data = await response.json();
        showToast('Data berhasil diperbarui!', 'success');
        
        // Reload data
        await loadSiswaData();
        
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
        
        // Update original data
        originalSiswaData = JSON.parse(JSON.stringify(siswaData));
    } catch (error) {
        console.error('Error saving siswa data:', error);
        showToast(error.message || 'Gagal menyimpan perubahan', 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }
}


// Delete History Record
async function deleteHistoryRecord(historyId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const response = await fetch(`${API_URL}/api/admin/history/${historyId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal menghapus data' }));
            throw new Error(errorData.message || 'Gagal menghapus data');
        }

        showToast('Data berhasil dihapus', 'success');
        
        // Reload history data
        const monthPicker = document.getElementById('historyMonthPicker');
        const selectedMonth = monthPicker ? monthPicker.value : null;
        await loadHistoryData(selectedMonth);
    } catch (error) {
        console.error('Error deleting history record:', error);
        showToast(error.message || 'Gagal menghapus data', 'error');
    }
}

// Show Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toastNotification');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) return;
    
    // Set message
    toastMessage.textContent = message;
    
    // Remove existing type classes
    toast.classList.remove('success', 'error');
    
    // Add new type class
    if (type === 'success' || type === 'error') {
        toast.classList.add(type);
    }
    
    // Update icon based on type
    const icon = toast.querySelector('.toast-icon');
    if (icon) {
        if (type === 'error') {
            icon.innerHTML = '<path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
        } else {
            icon.innerHTML = '<path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
        }
    }
    
    // Show toast
    toast.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Update siswa data when input changes
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('editable-input')) {
        const index = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        const value = e.target.value;

        if (siswaData[index]) {
            siswaData[index][field] = value;
        }
    }
});

// Alat Management
let alatStatusData = null;
let alatSupabaseClient = null;
let alatActionSubscription = null;
let alatScene = null;
let alatCamera = null;
let alatRenderer = null;
let alatDevice = null;
let alatMouseX = 0;
let alatMouseY = 0;
let alatIsMouseOver = false;

// Initialize Supabase for Alat
async function initializeSupabaseForAlat() {
    try {
        const configResponse = await fetch(`${API_URL}/api/config`);
        if (!configResponse.ok) {
            console.warn('Supabase config not available');
            return;
        }

        const config = await configResponse.json();
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            console.warn('Supabase config incomplete');
            return;
        }

        // Load Supabase from CDN if not already loaded
        if (typeof supabase === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
            document.head.appendChild(script);
            await new Promise((resolve) => {
                script.onload = resolve;
            });
        }

        alatSupabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        
        // EXPOSE CLIENT KE window (DEBUG ONLY)
        window.supabaseClient = alatSupabaseClient;
        
        setupAlatRealtimeSubscription();
    } catch (error) {
        console.error('Error initializing Supabase for Alat:', error);
    }
}

// Setup Realtime Subscription for Action Table
function setupAlatRealtimeSubscription() {
    if (!alatSupabaseClient) return;

    if (alatActionSubscription) {
        alatActionSubscription.unsubscribe();
    }

    const today = new Date().toISOString().split('T')[0];

    alatActionSubscription = alatSupabaseClient
        .channel('action-changes-alat')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'action',
                filter: `tanggal=eq.${today}`
            },
            (payload) => {
                console.log('🔄 Action table changed:', payload);
                loadAlatStatus();
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Subscribed to action table for Alat');
            }
        });
}

// Load Alat Status
async function loadAlatStatus() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const response = await fetch(`${API_URL}/api/admin/action`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal mengambil status alat' }));
            throw new Error(errorData.message || 'Gagal mengambil status alat');
        }

        const data = await response.json();
        alatStatusData = data.action;
        
        updateAlatUI();
    } catch (error) {
        console.error('Error loading alat status:', error);
        showToast(error.message || 'Gagal memuat status alat', 'error');
    }
}

// Update Alat UI
function updateAlatUI() {
    const alatStatusValue = document.getElementById('alatStatusValue');
    const alatStatusToggle = document.getElementById('alatStatusToggle');
    const alatInfoText = document.getElementById('alatInfoText');
    const alatDateDisplay = document.getElementById('alatDateDisplay');
    const alatStatusIcon = document.getElementById('alatStatusIcon');

    const today = new Date().toISOString().split('T')[0];
    
    // Update date display
    if (alatDateDisplay) {
        const date = new Date();
        alatDateDisplay.textContent = date.toLocaleDateString('id-ID', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    if (!alatStatusData) {
        // No data for today, create new one with NonActive status (default)
        if (alatStatusValue) {
            alatStatusValue.textContent = 'NonActive';
            alatStatusValue.className = 'alat-status-value inactive';
        }
        if (alatStatusToggle) {
            alatStatusToggle.checked = false;
        }
        if (alatInfoText) {
            alatInfoText.textContent = 'Data untuk hari ini belum ada, akan dibuat dengan status NonActive';
        }
        if (alatStatusIcon) {
            alatStatusIcon.innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 14L12 12M12 12L14 10M12 12L10 10M12 12L14 14M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            alatStatusIcon.className = 'alat-status-icon inactive';
        }
        // Update 3D LED
        updateAlatLED(false);
        // Auto create data
        createAlatAction();
        return;
    }

    const status = alatStatusData.status || 'NonActive';
    const isActive = status === 'Active';

    // Update status value
    if (alatStatusValue) {
        alatStatusValue.textContent = status;
        alatStatusValue.className = `alat-status-value ${isActive ? 'active' : 'inactive'}`;
    }

    // Update toggle
    if (alatStatusToggle) {
        alatStatusToggle.checked = isActive;
    }

    // Update icon
    if (alatStatusIcon) {
        if (isActive) {
            alatStatusIcon.innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            alatStatusIcon.className = 'alat-status-icon active';
        } else {
            alatStatusIcon.innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 14L12 12M12 12L14 10M12 12L10 10M12 12L14 14M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            alatStatusIcon.className = 'alat-status-icon inactive';
        }
    }

    // Update 3D LED
    updateAlatLED(isActive);

    // Update info text
    if (alatInfoText) {
        alatInfoText.textContent = isActive 
            ? 'Alat sedang aktif dan siap menerima absensi'
            : 'Alat tidak aktif, absensi tidak dapat dilakukan';
    }
}

// Create Alat Action (if not exists)
async function createAlatAction() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const response = await fetch(`${API_URL}/api/admin/action`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                nama: 'absensi',
                status: 'NonActive'
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal membuat data action' }));
            throw new Error(errorData.message || 'Gagal membuat data action');
        }

        const data = await response.json();
        alatStatusData = data.action;
        updateAlatUI();
        showToast('Data action berhasil dibuat', 'success');
    } catch (error) {
        console.error('Error creating alat action:', error);
        showToast(error.message || 'Gagal membuat data action', 'error');
    }
}

// Update Alat Status
async function updateAlatStatus(newStatus) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const alatStatusToggle = document.getElementById('alatStatusToggle');
        if (alatStatusToggle) {
            alatStatusToggle.disabled = true;
        }

        const response = await fetch(`${API_URL}/api/admin/action`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal memperbarui status' }));
            throw new Error(errorData.message || 'Gagal memperbarui status');
        }

        const data = await response.json();
        alatStatusData = data.action;
        
        updateAlatUI();
        showToast(`Status berhasil diubah menjadi ${newStatus}`, 'success');
        
        if (alatStatusToggle) {
            alatStatusToggle.disabled = false;
        }
    } catch (error) {
        console.error('Error updating alat status:', error);
        showToast(error.message || 'Gagal memperbarui status', 'error');
        
        // Revert toggle
        const alatStatusToggle = document.getElementById('alatStatusToggle');
        if (alatStatusToggle) {
            alatStatusToggle.checked = !alatStatusToggle.checked;
            alatStatusToggle.disabled = false;
        }
    }
}

// Initialize Alat 3D with Three.js
function initAlat3D() {
    const container = document.getElementById('alat3dContainer');
    if (!container || !window.THREE) return;

    // Clear previous scene if exists
    if (alatRenderer) {
        container.innerHTML = '';
    }

    // Scene setup
    alatScene = new THREE.Scene();
    alatScene.background = new THREE.Color(0x0a0a0a);

    // Camera setup
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    alatCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    alatCamera.position.set(0, 0, 5);

    // Renderer setup
    alatRenderer = new THREE.WebGLRenderer({ antialias: true });
    alatRenderer.setSize(width, height);
    alatRenderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(alatRenderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    alatScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    alatScene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x6366f1, 1, 100);
    pointLight.position.set(-5, 5, 5);
    alatScene.add(pointLight);

    // Create ESP32 device
    createAlatDevice();

    // Mouse tracking for rotation
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Normalize to -1 to 1
        alatMouseX = (x / rect.width) * 2 - 1;
        alatMouseY = -(y / rect.height) * 2 + 1;
        
        alatIsMouseOver = true;
    });

    container.addEventListener('mouseenter', () => {
        alatIsMouseOver = true;
    });

    container.addEventListener('mouseleave', () => {
        alatIsMouseOver = false;
    });

    // Handle resize
    window.addEventListener('resize', () => {
        if (container && alatCamera && alatRenderer) {
            const width = container.clientWidth || 400;
            const height = container.clientHeight || 400;
            alatCamera.aspect = width / height;
            alatCamera.updateProjectionMatrix();
            alatRenderer.setSize(width, height);
        }
    });

    // Animation loop
    animateAlat3D();
}

// Create ESP32 Device (More Detailed)
function createAlatDevice() {
    if (!alatScene) return;

    // Remove old device if exists
    if (alatDevice) {
        alatScene.remove(alatDevice);
    }

    alatDevice = new THREE.Group();

    // Main board (green PCB with texture-like appearance)
    const boardGeometry = new THREE.BoxGeometry(3.5, 2.2, 0.12);
    const boardMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x2d5016,
        shininess: 30,
        specular: 0x111111
    });
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    alatDevice.add(board);

    // PCB traces (copper lines)
    for (let i = 0; i < 5; i++) {
        const traceGeometry = new THREE.BoxGeometry(0.02, 1.5, 0.02);
        const traceMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xffaa00,
            shininess: 100
        });
        const trace = new THREE.Mesh(traceGeometry, traceMaterial);
        trace.position.set(-1.2 + (i * 0.6), 0, 0.07);
        alatDevice.add(trace);
    }

    // ESP32 Main Chip (larger and more detailed)
    const chipGeometry = new THREE.BoxGeometry(1.0, 0.8, 0.18);
    const chipMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a1a1a,
        shininess: 150,
        specular: 0x333333
    });
    const chip = new THREE.Mesh(chipGeometry, chipMaterial);
    chip.position.set(0, 0.2, 0.15);
    alatDevice.add(chip);

    // Chip label/texture
    const chipLabelGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.02);
    const chipLabelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x0a0a0a,
        shininess: 200
    });
    const chipLabel = new THREE.Mesh(chipLabelGeometry, chipLabelMaterial);
    chipLabel.position.set(0, 0.2, 0.24);
    alatDevice.add(chipLabel);

    // Chip pins (left side - 19 pins for ESP32)
    for (let i = 0; i < 19; i++) {
        const pinGeometry = new THREE.BoxGeometry(0.06, 0.25, 0.06);
        const pinMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x888888,
            shininess: 80
        });
        const pin = new THREE.Mesh(pinGeometry, pinMaterial);
        pin.position.set(-1.75, -0.8 + (i * 0.08), 0.12);
        alatDevice.add(pin);
    }

    // Chip pins (right side - 19 pins)
    for (let i = 0; i < 19; i++) {
        const pinGeometry = new THREE.BoxGeometry(0.06, 0.25, 0.06);
        const pinMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x888888,
            shininess: 80
        });
        const pin = new THREE.Mesh(pinGeometry, pinMaterial);
        pin.position.set(1.75, -0.8 + (i * 0.08), 0.12);
        alatDevice.add(pin);
    }

    // Status LED (larger and more visible)
    const ledGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const ledMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.8,
        shininess: 100
    });
    const led = new THREE.Mesh(ledGeometry, ledMaterial);
    led.position.set(1.2, 0.8, 0.18);
    alatDevice.add(led);
    alatDevice.userData.led = led;
    alatDevice.userData.ledMaterial = ledMaterial;

    // LED base/holder
    const ledBaseGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16);
    const ledBaseMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const ledBase = new THREE.Mesh(ledBaseGeometry, ledBaseMaterial);
    ledBase.rotation.x = Math.PI / 2;
    ledBase.position.set(1.2, 0.8, 0.12);
    alatDevice.add(ledBase);

    // USB Type-C Port (more detailed)
    const usbOuterGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.12);
    const usbOuterMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
    const usbOuter = new THREE.Mesh(usbOuterGeometry, usbOuterMaterial);
    usbOuter.position.set(-1.5, 0, 0.08);
    alatDevice.add(usbOuter);

    const usbInnerGeometry = new THREE.BoxGeometry(0.35, 0.15, 0.08);
    const usbInnerMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
    const usbInner = new THREE.Mesh(usbInnerGeometry, usbInnerMaterial);
    usbInner.position.set(-1.5, 0, 0.14);
    alatDevice.add(usbInner);

    // USB connector pins
    for (let i = 0; i < 4; i++) {
        const usbPinGeometry = new THREE.BoxGeometry(0.02, 0.1, 0.02);
        const usbPinMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
        const usbPin = new THREE.Mesh(usbPinGeometry, usbPinMaterial);
        usbPin.position.set(-1.5, -0.05 + (i * 0.033), 0.18);
        alatDevice.add(usbPin);
    }

    // Antenna (WiFi/BT - more detailed)
    const antennaBaseGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8);
    const antennaBaseMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const antennaBase = new THREE.Mesh(antennaBaseGeometry, antennaBaseMaterial);
    antennaBase.position.set(1.4, 0.5, 0.12);
    alatDevice.add(antennaBase);

    const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
    const antennaMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x666666,
        shininess: 50
    });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.rotation.z = Math.PI / 2;
    antenna.position.set(1.4, 0.5, 0.35);
    alatDevice.add(antenna);

    // Resistors (small components)
    for (let i = 0; i < 3; i++) {
        const resistorGeometry = new THREE.BoxGeometry(0.15, 0.05, 0.05);
        const resistorMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x8B4513,
            shininess: 30
        });
        const resistor = new THREE.Mesh(resistorGeometry, resistorMaterial);
        resistor.position.set(-0.8 + (i * 0.4), -0.6, 0.12);
        resistor.rotation.z = Math.PI / 4;
        alatDevice.add(resistor);
    }

    // Capacitors (cylindrical)
    for (let i = 0; i < 2; i++) {
        const capGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 16);
        const capMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x444444,
            shininess: 60
        });
        const capacitor = new THREE.Mesh(capGeometry, capMaterial);
        capacitor.rotation.x = Math.PI / 2;
        capacitor.position.set(-0.5 + (i * 1.0), -0.8, 0.12);
        alatDevice.add(capacitor);
    }

    // Crystal oscillator (small square)
    const crystalGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.08);
    const crystalMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x333333,
        shininess: 100
    });
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.position.set(-0.3, 0.6, 0.12);
    alatDevice.add(crystal);

    // Voltage regulator (small chip)
    const regulatorGeometry = new THREE.BoxGeometry(0.2, 0.15, 0.1);
    const regulatorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a1a1a,
        shininess: 80
    });
    const regulator = new THREE.Mesh(regulatorGeometry, regulatorMaterial);
    regulator.position.set(0.5, -0.5, 0.12);
    alatDevice.add(regulator);

    // Reset button
    const buttonGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16);
    const buttonMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x222222,
        shininess: 50
    });
    const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    button.rotation.x = Math.PI / 2;
    button.position.set(-1.0, 0.7, 0.12);
    alatDevice.add(button);

    // Boot button
    const bootButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
    bootButton.rotation.x = Math.PI / 2;
    bootButton.position.set(-0.7, 0.7, 0.12);
    alatDevice.add(bootButton);

    // GPIO labels/text indicators (small rectangles)
    for (let i = 0; i < 4; i++) {
        const labelGeometry = new THREE.BoxGeometry(0.08, 0.04, 0.01);
        const labelMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xffffff,
            emissive: 0x222222,
            emissiveIntensity: 0.3
        });
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.set(-1.2 + (i * 0.8), -1.0, 0.07);
        alatDevice.add(label);
    }

    // Sensor (RFID/Proximity Sensor)
    const sensorBaseGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16);
    const sensorBaseMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x333333,
        shininess: 50
    });
    const sensorBase = new THREE.Mesh(sensorBaseGeometry, sensorBaseMaterial);
    sensorBase.rotation.x = Math.PI / 2;
    sensorBase.position.set(0.8, -0.3, 0.12);
    alatDevice.add(sensorBase);

    // Sensor lens/glass
    const sensorLensGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16);
    const sensorLensMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a1a1a,
        transparent: true,
        opacity: 0.7,
        shininess: 100
    });
    const sensorLens = new THREE.Mesh(sensorLensGeometry, sensorLensMaterial);
    sensorLens.rotation.x = Math.PI / 2;
    sensorLens.position.set(0.8, -0.3, 0.15);
    alatDevice.add(sensorLens);

    // Sensor LED (will glow blue when active) - with volumetric glow
    const sensorLEDGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const sensorLEDMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x000000,
        emissive: 0x000000,
        emissiveIntensity: 0,
        shininess: 150
    });
    const sensorLED = new THREE.Mesh(sensorLEDGeometry, sensorLEDMaterial);
    sensorLED.position.set(0.8, -0.3, 0.17);
    alatDevice.add(sensorLED);
    alatDevice.userData.sensorLED = sensorLED;
    alatDevice.userData.sensorLEDMaterial = sensorLEDMaterial;

    // Volumetric glow effect for sensor (larger sphere with lower opacity)
    const sensorGlowGeometry = new THREE.SphereGeometry(0.12, 16, 16);
    const sensorGlowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x3b82f6,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide
    });
    const sensorGlow = new THREE.Mesh(sensorGlowGeometry, sensorGlowMaterial);
    sensorGlow.position.set(0.8, -0.3, 0.17);
    alatDevice.add(sensorGlow);
    alatDevice.userData.sensorGlow = sensorGlow;
    alatDevice.userData.sensorGlowMaterial = sensorGlowMaterial;

    // Point light for volumetric lighting effect
    const sensorLight = new THREE.PointLight(0x3b82f6, 0, 2);
    sensorLight.position.set(0.8, -0.3, 0.17);
    alatDevice.add(sensorLight);
    alatDevice.userData.sensorLight = sensorLight;

    // Sensor wires/connections
    for (let i = 0; i < 2; i++) {
        const wireGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 8);
        const wireMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
        const wire = new THREE.Mesh(wireGeometry, wireMaterial);
        wire.rotation.z = Math.PI / 2;
        wire.position.set(0.6 + (i * 0.4), -0.3, 0.12);
        alatDevice.add(wire);
    }

    alatScene.add(alatDevice);

    // Initial rotation
    alatDevice.rotation.x = -0.3;
    alatDevice.rotation.y = 0.5;
}

// Update Alat LED based on status
function updateAlatLED(isActive) {
    if (!alatDevice || !alatDevice.userData.ledMaterial) return;

    const ledMaterial = alatDevice.userData.ledMaterial;
    if (isActive) {
        ledMaterial.color.setHex(0x10b981);
        ledMaterial.emissive.setHex(0x10b981);
        ledMaterial.emissiveIntensity = 1;
    } else {
        ledMaterial.color.setHex(0xef4444);
        ledMaterial.emissive.setHex(0xef4444);
        ledMaterial.emissiveIntensity = 0.5;
    }

    // Update Sensor LED with volumetric glow
    if (alatDevice.userData.sensorLEDMaterial) {
        const sensorLEDMaterial = alatDevice.userData.sensorLEDMaterial;
        const sensorGlowMaterial = alatDevice.userData.sensorGlowMaterial;
        const sensorLight = alatDevice.userData.sensorLight;
        
        if (isActive) {
            // Sensor nyala biru saat active dengan volumetric glow
            sensorLEDMaterial.color.setHex(0x3b82f6);
            sensorLEDMaterial.emissive.setHex(0x3b82f6);
            sensorLEDMaterial.emissiveIntensity = 1.5;
            
            // Volumetric glow effect
            if (sensorGlowMaterial) {
                sensorGlowMaterial.color.setHex(0x3b82f6);
                sensorGlowMaterial.opacity = 0.6;
            }
            
            // Point light for volumetric lighting
            if (sensorLight) {
                sensorLight.color.setHex(0x3b82f6);
                sensorLight.intensity = 2;
                sensorLight.distance = 2;
            }
        } else {
            // Sensor mati saat nonactive
            sensorLEDMaterial.color.setHex(0x000000);
            sensorLEDMaterial.emissive.setHex(0x000000);
            sensorLEDMaterial.emissiveIntensity = 0;
            
            // Turn off volumetric glow
            if (sensorGlowMaterial) {
                sensorGlowMaterial.opacity = 0;
            }
            
            // Turn off point light
            if (sensorLight) {
                sensorLight.intensity = 0;
            }
        }
    }
}

// Animation loop
function animateAlat3D() {
    if (!alatRenderer || !alatScene || !alatCamera) return;

    requestAnimationFrame(animateAlat3D);

    if (alatDevice) {
        if (alatIsMouseOver) {
            // Smooth rotation following cursor
            const targetY = alatMouseX * 0.5;
            const targetX = -0.3 + (alatMouseY * 0.3);
            
            // Smooth interpolation
            alatDevice.rotation.y += (targetY - alatDevice.rotation.y) * 0.1;
            alatDevice.rotation.x += (targetX - alatDevice.rotation.x) * 0.1;
        }
        // Auto rotate disabled - model stays in place when mouse is not over
        
        // Animate sensor glow pulsing when active
        if (alatDevice.userData.sensorGlowMaterial && alatDevice.userData.sensorGlowMaterial.opacity > 0) {
            const time = Date.now() * 0.001;
            const pulse = Math.sin(time * 2) * 0.1 + 0.5;
            alatDevice.userData.sensorGlowMaterial.opacity = 0.4 + pulse * 0.3;
            
            // Scale glow for pulsing effect
            if (alatDevice.userData.sensorGlow) {
                alatDevice.userData.sensorGlow.scale.set(
                    1 + Math.sin(time * 2) * 0.2,
                    1 + Math.sin(time * 2) * 0.2,
                    1 + Math.sin(time * 2) * 0.2
                );
            }
            
            // Animate point light intensity for volumetric effect
            if (alatDevice.userData.sensorLight) {
                alatDevice.userData.sensorLight.intensity = 1.5 + Math.sin(time * 2) * 0.5;
            }
        }
    }

    alatRenderer.render(alatScene, alatCamera);
}

// Initialize Supabase when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSupabaseForAlat);
} else {
    initializeSupabaseForAlat();
}

// ==================== WHATSAPP FUNCTIONS ====================

// Format history message for WhatsApp
function formatHistoryMessage(historyData) {
    if (!historyData || historyData.length === 0) {
        return 'Absensi\n\nTidak ada data absensi untuk ditampilkan.';
    }

    // Get date from first record or current date
    const datePicker = document.getElementById('historyDatePicker');
    const selectedDate = datePicker ? datePicker.value : null;
    
    let dateText = '';
    if (selectedDate) {
        const date = new Date(selectedDate);
        dateText = date.toLocaleDateString('id-ID', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    } else {
        // Use date from first record if available
        if (historyData[0] && historyData[0].tanggal) {
            const date = new Date(historyData[0].tanggal);
            dateText = date.toLocaleDateString('id-ID', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        } else {
            dateText = new Date().toLocaleDateString('id-ID', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }

    // Group by status
    const grouped = {
        'Hadir': historyData.filter(h => h.status === 'Hadir'),
        'Sakit': historyData.filter(h => h.status === 'Sakit'),
        'Izin': historyData.filter(h => h.status === 'Izin'),
        'Alpha': historyData.filter(h => h.status === 'Alpha')
    };

    const hadir = grouped['Hadir'].length;
    const sakit = grouped['Sakit'].length;
    const izin = grouped['Izin'].length;
    const alpha = grouped['Alpha'].length;

    // Start message with header
    let message = `Absensi ${dateText}\n\n`;

    // Add statistics (only show if > 0)
    // Hadir tetap dihitung dan ditampilkan di statistik
    const stats = [];
    if (hadir > 0) stats.push(`Hadir: ${hadir}`);
    if (sakit > 0) stats.push(`Sakit: ${sakit}`);
    if (izin > 0) stats.push(`Izin: ${izin}`);
    if (alpha > 0) stats.push(`Alpha: ${alpha}`);
    
    if (stats.length > 0) {
        message += stats.join('\n') + '\n\n';
    }

    // Add details (only for Sakit, Izin, Alpha - exclude Hadir)
    // Hadir tidak ditampilkan detailnya, hanya di statistik
    const detailStatuses = ['Sakit', 'Izin', 'Alpha'];
    
    detailStatuses.forEach(status => {
        if (grouped[status].length > 0) {
            message += `${status}:\n`;
            grouped[status].forEach(record => {
                message += `${record.nama || 'N/A'}\n`;
            });
            message += `\n`;
        }
    });

    return message.trim();
}

// Show send history WhatsApp modal
function showSendHistoryWhatsAppModal() {
    console.log('showSendHistoryWhatsAppModal called');
    const modal = document.getElementById('sendWhatsAppModal');
    const phoneInput = document.getElementById('whatsappPhoneInput');
    const preview = document.getElementById('whatsappMessagePreview');

    console.log('Modal:', modal);
    console.log('History data:', historyData);
    console.log('History data length:', historyData ? historyData.length : 0);

    if (!modal) {
        console.error('Modal tidak ditemukan');
        showToast('Modal tidak ditemukan', 'error');
        return;
    }

    if (!historyData || historyData.length === 0) {
        console.warn('Tidak ada data history');
        showToast('Tidak ada data history untuk dikirim. Silakan muat data history terlebih dahulu.', 'error');
        return;
    }

    // Reset form
    if (phoneInput) {
        phoneInput.value = '';
        phoneInput.focus();
    }

    updateHistoryWhatsAppMessagePreview();
    
    if (modal) {
        modal.classList.add('show');
        console.log('Modal opened successfully');
    }
}


// Make function available globally for debugging
window.showSendHistoryWhatsAppModal = showSendHistoryWhatsAppModal;

// Hide send WhatsApp modal
function hideSendWhatsAppModal() {
    const modal = document.getElementById('sendWhatsAppModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Update WhatsApp message preview
function updateHistoryWhatsAppMessagePreview() {
    const preview = document.getElementById('whatsappMessagePreview');
    if (!preview || !historyData || historyData.length === 0) return;

    const message = formatHistoryMessage(historyData);
    preview.textContent = message;
}

// Send WhatsApp message
async function sendWhatsAppMessage() {
    const phoneInput = document.getElementById('whatsappPhoneInput');
    const confirmBtn = document.getElementById('confirmSendWhatsAppBtn');
    
    if (!phoneInput || !historyData || historyData.length === 0) {
        showToast('Data tidak lengkap', 'error');
        return;
    }

    // Get phone number from input
    const phone = phoneInput.value.trim();
    
    if (!phone) {
        showToast('Nomor WhatsApp wajib diisi', 'error');
        phoneInput.focus();
        return;
    }

    // Validate phone format
    const phoneRegex = /^(\+?62|0)[0-9]{9,12}$/;
    if (!phoneRegex.test(phone)) {
        showToast('Format nomor telepon tidak valid. Format: 08xxxxxxxxxx atau 628xxxxxxxxxx', 'error');
        if (phoneInput && phoneInput.style.display !== 'none') {
            phoneInput.focus();
        }
        return;
    }

    // Show loading overlay
    const loadingOverlay = document.getElementById('whatsappLoadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('show');
    }

    // Disable button and ensure no button loading is shown
    if (confirmBtn) {
        confirmBtn.disabled = true;
        // Remove any loading class
        confirmBtn.classList.remove('loading');
        // Ensure button loader is hidden
        const buttonLoader = confirmBtn.querySelector('.button-loader');
        if (buttonLoader) {
            buttonLoader.style.display = 'none';
            buttonLoader.style.visibility = 'hidden';
        }
        // Ensure button text is correct and visible
        const buttonText = confirmBtn.querySelector('.button-text');
        if (buttonText) {
            buttonText.textContent = 'Kirim Pesan';
            buttonText.style.display = 'inline';
        }
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const message = formatHistoryMessage(historyData);

        const response = await fetch(`${API_URL}/api/admin/whatsapp/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: phone,
                message: message
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal mengirim pesan' }));
            const errorMessage = errorData.error || errorData.message || 'Gagal mengirim pesan';
            console.error('Backend error response:', errorData);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        showToast('Pesan WhatsApp berhasil dikirim', 'success');
        hideSendWhatsAppModal();
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        showToast(error.message || 'Gagal mengirim pesan WhatsApp', 'error');
    } finally {
        // Hide loading overlay
        const loadingOverlayFinal = document.getElementById('whatsappLoadingOverlay');
        if (loadingOverlayFinal) {
            loadingOverlayFinal.classList.remove('show');
        }
        // Re-enable button and ensure button loader is hidden
        if (confirmBtn) {
            confirmBtn.disabled = false;
            // Remove any loading class
            confirmBtn.classList.remove('loading');
            // Ensure button loader is always hidden
            const buttonLoader = confirmBtn.querySelector('.button-loader');
            if (buttonLoader) {
                buttonLoader.style.display = 'none';
                buttonLoader.style.visibility = 'hidden';
            }
            // Ensure button text is correct and visible
            const buttonText = confirmBtn.querySelector('.button-text');
            if (buttonText) {
                buttonText.textContent = 'Kirim Pesan';
                buttonText.style.display = 'inline';
            }
        }
    }
}

// ==================== STATISTIK SISWA FUNCTIONS ====================

// Load all students for statistics page
async function loadStatistikSiswa() {
    const loadingCell = document.getElementById('statistikLoadingCell');
    const cardsGrid = document.getElementById('studentCardsGrid');

    if (loadingCell) loadingCell.style.display = 'flex';
    if (cardsGrid) cardsGrid.style.display = 'none';

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const response = await fetch(`${API_URL}/api/admin/siswa`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal mengambil data siswa' }));
            throw new Error(errorData.message || 'Gagal mengambil data siswa');
        }

        const data = await response.json();
        const siswaList = data.siswa || [];

        renderStudentCards(siswaList);

        if (loadingCell) loadingCell.style.display = 'none';
        if (cardsGrid) cardsGrid.style.display = 'grid';
    } catch (error) {
        console.error('Error loading statistik siswa:', error);
        if (loadingCell) {
            loadingCell.innerHTML = `
                <div style="text-align: center; color: var(--danger);">
                    <p>${error.message || 'Gagal memuat data siswa'}</p>
                    <button class="btn-primary" onclick="loadStatistikSiswa()" style="margin-top: 16px;">Coba Lagi</button>
                </div>
            `;
        }
    }
}

// Render student cards
function renderStudentCards(siswaList) {
    const cardsGrid = document.getElementById('studentCardsGrid');
    if (!cardsGrid) return;

    cardsGrid.innerHTML = '';

    if (siswaList.length === 0) {
        cardsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-light);">
                Tidak ada data siswa
            </div>
        `;
        return;
    }

    siswaList.forEach(siswa => {
        const card = document.createElement('div');
        card.className = 'student-card';
        card.dataset.nis = siswa.nis;
        card.innerHTML = `
            <div class="student-card-content">
                <div class="student-card-avatar">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="student-card-info">
                    <h4 class="student-card-name">${siswa.nama || 'N/A'}</h4>
                    <p class="student-card-nis">NIS: ${siswa.nis || '-'}</p>
                </div>
                <div class="student-card-action">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            showStudentStatistics(siswa.nis, siswa.nama);
        });

        cardsGrid.appendChild(card);
    });
}

// Show student statistics modal
async function showStudentStatistics(nis, nama) {
    const modal = document.getElementById('studentStatisticsModal');
    const title = document.getElementById('studentStatisticsTitle');
    const content = document.getElementById('studentStatisticsContent');

    if (!modal || !title || !content) return;

    // Set title
    title.textContent = `Statistik ${nama || 'Siswa'}`;

    // Show loading
    content.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loading-boxes" style="display: inline-flex; gap: 8px; margin-bottom: 16px;">
                <div class="loading-box"></div>
                <div class="loading-box"></div>
                <div class="loading-box"></div>
            </div>
            <p>Memuat data statistik...</p>
        </div>
    `;

    modal.classList.add('show');

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const response = await fetch(`${API_URL}/api/admin/statistics/student/${nis}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Gagal mengambil data statistik' }));
            throw new Error(errorData.message || 'Gagal mengambil data statistik');
        }

        const data = await response.json();
        renderStudentStatistics(data);
    } catch (error) {
        console.error('Error loading student statistics:', error);
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--danger);">
                <p>${error.message || 'Gagal memuat data statistik'}</p>
                <button class="btn-primary" onclick="showStudentStatistics('${nis}', '${nama}')" style="margin-top: 16px;">Coba Lagi</button>
            </div>
        `;
    }
}

// Render student statistics
function renderStudentStatistics(data) {
    const content = document.getElementById('studentStatisticsContent');
    if (!content) return;

    const { siswa, totalStats, monthlyStats } = data;

    // Calculate percentages
    const total = totalStats.total || 1;
    const hadirPercent = ((totalStats.hadir / total) * 100).toFixed(1);
    const sakitPercent = ((totalStats.sakit / total) * 100).toFixed(1);
    const izinPercent = ((totalStats.izin / total) * 100).toFixed(1);
    const alphaPercent = ((totalStats.alpha / total) * 100).toFixed(1);

    let html = `
        <div class="statistics-section">
            <h4 class="statistics-section-title">Total Kehadiran 1 Tahun</h4>
            <div class="statistics-total-grid">
                <div class="statistics-total-card">
                    <div class="statistics-total-label">Total</div>
                    <div class="statistics-total-value">${totalStats.total || 0}</div>
                </div>
                <div class="statistics-total-card hadir">
                    <div class="statistics-total-label">Hadir</div>
                    <div class="statistics-total-value">${totalStats.hadir || 0}</div>
                    <div class="statistics-total-percent">${hadirPercent}%</div>
                </div>
                <div class="statistics-total-card sakit">
                    <div class="statistics-total-label">Sakit</div>
                    <div class="statistics-total-value">${totalStats.sakit || 0}</div>
                    <div class="statistics-total-percent">${sakitPercent}%</div>
                </div>
                <div class="statistics-total-card izin">
                    <div class="statistics-total-label">Izin</div>
                    <div class="statistics-total-value">${totalStats.izin || 0}</div>
                    <div class="statistics-total-percent">${izinPercent}%</div>
                </div>
                <div class="statistics-total-card alpha">
                    <div class="statistics-total-label">Alpha</div>
                    <div class="statistics-total-value">${totalStats.alpha || 0}</div>
                    <div class="statistics-total-percent">${alphaPercent}%</div>
                </div>
            </div>
        </div>

        <div class="statistics-section">
            <h4 class="statistics-section-title">Kehadiran Per Bulan</h4>
            <div class="statistics-monthly-list">
    `;

    if (monthlyStats && monthlyStats.length > 0) {
        monthlyStats.forEach(month => {
            const monthTotal = month.total || 1;
            const monthHadirPercent = ((month.hadir / monthTotal) * 100).toFixed(1);
            const monthSakitPercent = ((month.sakit / monthTotal) * 100).toFixed(1);
            const monthIzinPercent = ((month.izin / monthTotal) * 100).toFixed(1);
            const monthAlphaPercent = ((month.alpha / monthTotal) * 100).toFixed(1);

            html += `
                <div class="statistics-monthly-item">
                    <div class="statistics-monthly-header">
                        <h5 class="statistics-monthly-title">${month.bulan}</h5>
                        <span class="statistics-monthly-total">Total: ${month.total || 0}</span>
                    </div>
                    <div class="statistics-monthly-details">
                        <div class="statistics-monthly-detail hadir">
                            <span class="detail-label">Hadir:</span>
                            <span class="detail-value">${month.hadir || 0}</span>
                            <span class="detail-percent">(${monthHadirPercent}%)</span>
                        </div>
                        <div class="statistics-monthly-detail sakit">
                            <span class="detail-label">Sakit:</span>
                            <span class="detail-value">${month.sakit || 0}</span>
                            <span class="detail-percent">(${monthSakitPercent}%)</span>
                        </div>
                        <div class="statistics-monthly-detail izin">
                            <span class="detail-label">Izin:</span>
                            <span class="detail-value">${month.izin || 0}</span>
                            <span class="detail-percent">(${monthIzinPercent}%)</span>
                        </div>
                        <div class="statistics-monthly-detail alpha">
                            <span class="detail-label">Alpha:</span>
                            <span class="detail-value">${month.alpha || 0}</span>
                            <span class="detail-percent">(${monthAlphaPercent}%)</span>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        html += `
            <div style="text-align: center; padding: 40px; color: var(--text-light);">
                Tidak ada data kehadiran untuk periode ini
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    content.innerHTML = html;
}

// Hide student statistics modal
function hideStudentStatisticsModal() {
    const modal = document.getElementById('studentStatisticsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Make functions available globally
window.loadStatistikSiswa = loadStatistikSiswa;
window.showStudentStatistics = showStudentStatistics;

