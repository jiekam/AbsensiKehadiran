const API_URL = 'https://absensikehadiran-production.up.railway.app';

// Check authentication
const token = localStorage.getItem('token');
const isAdmin = localStorage.getItem('isAdmin');

if (!token) {
    window.location.href = 'index.html';
}

// Redirect admin to admin dashboard
if (isAdmin === 'true') {
    window.location.href = 'admin-dashboard.html';
}

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

// Initialize theme on load
initTheme();

// Theme toggle button
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

// Helper function to handle API errors
async function handleApiResponse(response) {
    const contentType = response.headers.get('content-type');
    let data;

    if (!response.ok) {
        // Try to get error message from response
        if (contentType && contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch (e) {
                data = { message: response.statusText || 'Terjadi kesalahan' };
            }
        } else {
            try {
                const text = await response.text();
                data = { message: text || response.statusText || 'Terjadi kesalahan' };
            } catch (e) {
                data = { message: response.statusText || 'Terjadi kesalahan' };
            }
        }

        if (response.status === 401 || response.status === 403) {
            const errorMsg = data.message || 'Sesi telah berakhir. Silakan login kembali.';
            console.error('Authentication error:', errorMsg);
            alert(errorMsg);
            localStorage.removeItem('token');
            localStorage.removeItem('siswa');
            window.location.href = 'index.html';
            return null;
        }
        
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    // If response is OK, parse JSON
    if (contentType && contentType.includes('application/json')) {
        data = await response.json();
    } else {
        const text = await response.text();
        throw new Error('Server mengembalikan respons yang tidak valid');
    }

    return data;
}

// Supabase client (will be initialized after fetching config)
let supabaseClient = null;
let currentUserData = null; // Store user data for realtime filtering
let actionSubscription = null;
let historySubscription = null;

// Elements
const welcomeTitle = document.getElementById('welcomeTitle');
const dateDisplay = document.getElementById('dateDisplay');
const refreshBtn = document.getElementById('refreshBtn');
const refreshBtnHeader = document.getElementById('refreshBtnHeader');
const logoutBtn = document.getElementById('logoutBtn');
const userInfoContent = document.getElementById('userInfoContent');
const machineStatusContent = document.getElementById('machineStatusContent');
const absenStatusContent = document.getElementById('absenStatusContent');
const dashboardTab = document.getElementById('dashboardTab');
const historyTab = document.getElementById('historyTab');
const analyticsTab = document.getElementById('analyticsTab');
const dashboardPage = document.getElementById('dashboardPage');
const historyPage = document.getElementById('historyPage');
const analyticsPage = document.getElementById('analyticsPage');
const monthSelector = document.getElementById('monthSelector');
const historyContent = document.getElementById('historyContent');
const analyticsContent = document.getElementById('analyticsContent');

// Set current date
let lastKnownDate = null;

function updateDateDisplay() {
    const today = new Date();
    const dateString = today.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    dateDisplay.textContent = dateString;
    
    // Get date in YYYY-MM-DD format for comparison (WIB timezone)
    // Convert to WIB (UTC+7) to match backend
    const wibOffset = 7 * 60; // WIB is UTC+7
    const utc = today.getTime() + (today.getTimezoneOffset() * 60000);
    const wibTime = new Date(utc + (wibOffset * 60000));
    const todayString = wibTime.toISOString().split('T')[0];
    
    // Check if date has changed
    if (lastKnownDate && lastKnownDate !== todayString) {
        console.log('Date changed detected, refreshing data...');
        console.log('Previous date:', lastKnownDate, 'New date:', todayString);
        fetchDashboardData();
    }
    
    lastKnownDate = todayString;
}

// Initialize date display
updateDateDisplay();

// Fetch dashboard data
async function fetchDashboardData() {
    try {
        userInfoContent.innerHTML = `
            <div class="loading-cell">
                <div class="loading-boxes">
                    <div class="loading-box"></div>
                    <div class="loading-box"></div>
                    <div class="loading-box"></div>
                </div>
                <span>Memuat data...</span>
            </div>
        `;
        
        machineStatusContent.innerHTML = `
            <div class="loading-cell">
                <div class="loading-boxes">
                    <div class="loading-box"></div>
                    <div class="loading-box"></div>
                    <div class="loading-box"></div>
                </div>
                <span>Memuat status...</span>
            </div>
        `;

        absenStatusContent.innerHTML = `
            <div class="loading-cell">
                <div class="loading-boxes">
                    <div class="loading-box"></div>
                    <div class="loading-box"></div>
                    <div class="loading-box"></div>
                </div>
                <span>Memuat status...</span>
            </div>
        `;

        const response = await fetch(`${API_URL}/dashboard`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await handleApiResponse(response);
        if (!data) return; // Error already handled

        if (data.user) {
            // Store user data for realtime filtering
            currentUserData = {
                rfid: data.user.rfid,
                nis: data.user.nis
            };
            
            renderUserInfo(data.user);
            renderMachineStatus(data.machineStatus);
            renderAbsenStatus(data.absenStatus, data.absenWaktu, data.hasRfid);
            welcomeTitle.textContent = `Hallo ${data.user.nama}`;
            
            // Setup realtime subscriptions if Supabase is initialized
            if (supabaseClient && !actionSubscription) {
                setupRealtimeSubscriptions();
            }
        } else {
            userInfoContent.innerHTML = `
                <div class="error-message">
                    Data user tidak ditemukan
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        userInfoContent.innerHTML = `
            <div class="error-message">
                ${error.message || 'Terjadi kesalahan saat memuat data'}
            </div>
        `;
        machineStatusContent.innerHTML = `
            <div class="error-message">
                ${error.message || 'Terjadi kesalahan saat memuat status'}
            </div>
        `;
        absenStatusContent.innerHTML = `
            <div class="error-message">
                ${error.message || 'Terjadi kesalahan saat memuat status'}
            </div>
        `;
    }
}

// Render absen status
function renderAbsenStatus(status, waktu, hasRfid) {
    // If RFID is not registered, show warning
    if (!hasRfid) {
        absenStatusContent.innerHTML = `
            <div class="absen-status-display rfid-warning">
                <div class="emoji-container rfid-warning-icon">
                    <span class="emoji shake">🔴</span>
                </div>
                <div class="absen-status-text">
                    <h3 class="absen-status-title">RFID belum terdaftar !</h3>
                    <p class="absen-status-subtitle">Kamu tidak bisa absen, silahkan hubungi sekretaris untuk mendaftarkan RFID !</p>
                </div>
            </div>
        `;
        return;
    }

    // If RFID is registered, show normal status
    let emoji = '';
    let title = '';
    let subtitle = '';
    let statusClass = '';
    
    // Format waktu jika ada
    let waktuText = '';
    if (waktu) {
        try {
            // Parse waktu (assuming format like HH:MM:SS or timestamp)
            const waktuDate = new Date(waktu);
            if (!isNaN(waktuDate.getTime())) {
                waktuText = waktuDate.toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                });
            } else {
                // If waktu is already in HH:MM:SS format
                waktuText = waktu;
            }
        } catch (e) {
            waktuText = waktu;
        }
    }
    
    switch (status) {
        case 'Hadir':
            emoji = '😊';
            title = 'Kamu sudah absen hari ini!';
            subtitle = waktuText ? `Waktu absen: ${waktuText}` : 'Terima kasih sudah melakukan absen';
            statusClass = 'success';
            break;
        case 'Sakit':
            emoji = '🤒';
            title = 'Hari ini kamu sakit apa? semoga lekas sembuh';
            subtitle = waktuText ? `Waktu absen: ${waktuText}` : 'Jaga kesehatan ya!';
            statusClass = 'warning';
            break;
        case 'Izin':
            emoji = '🤔';
            title = 'Hari ini ada urusan apa?';
            subtitle = waktuText ? `Waktu absen: ${waktuText}` : 'Semoga urusannya lancar';
            statusClass = 'info';
            break;
        case 'Alpha':
            emoji = '😰';
            title = 'Yah... Kamu kemana ini? kok gak ada kabar';
            subtitle = 'Silakan hubungi admin untuk konfirmasi';
            statusClass = 'danger';
            break;
        default:
            // Belum absen - mesin Active tapi belum absen
            emoji = '⚠️';
            title = 'Kamu belum absen hari ini!';
            subtitle = 'Silakan lakukan absen segera';
            statusClass = 'warning';
    }
    
    absenStatusContent.innerHTML = `
        <div class="absen-status-display ${statusClass}">
            <div class="emoji-container">
                <span class="emoji ${status === 'Hadir' ? 'bounce' : status === 'Alpha' ? 'shake' : 'pulse'}">${emoji}</span>
            </div>
            <div class="absen-status-text">
                <h3 class="absen-status-title">${title}</h3>
                <p class="absen-status-subtitle">${subtitle}</p>
            </div>
        </div>
    `;
}

// Render user info
function renderUserInfo(user) {
    userInfoContent.innerHTML = `
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Nama
                </div>
                <div class="info-value">${user.nama}</div>
            </div>
            <div class="info-item">
                <div class="info-label">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    NIS
                </div>
                <div class="info-value">${user.nis}</div>
            </div>
            <div class="info-item">
                <div class="info-label">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    RFID
                </div>
                <div class="info-value">${user.rfid || '-'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.5795 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42054 10.0723 3.742 9.96512 4.01131 9.77251C4.28062 9.5799 4.48571 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Role
                </div>
                <div class="info-value">${user.role || '-'}</div>
            </div>
        </div>
    `;
}

// Render machine status
function renderMachineStatus(status) {
    const isActive = status === 'Active';
    machineStatusContent.innerHTML = `
        <div class="machine-status-display">
            <div class="machine-status-icon ${isActive ? 'active' : 'inactive'}">
                ${isActive ? `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                ` : `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 14L12 12M12 12L14 10M12 12L10 10M12 12L14 14M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `}
            </div>
            <div class="machine-status-text">
                <h3 class="machine-status-title">Status Mesin</h3>
                <span class="status-badge ${status.toLowerCase()}">${status}</span>
            </div>
        </div>
    `;
}

// Refresh button function
function handleRefresh() {
    fetchDashboardData();
    // Add visual feedback
    if (refreshBtnHeader) {
        refreshBtnHeader.classList.add('refreshing');
        setTimeout(() => {
            refreshBtnHeader.classList.remove('refreshing');
        }, 1000);
    }
    if (refreshBtn) {
        refreshBtn.classList.add('refreshing');
        setTimeout(() => {
            refreshBtn.classList.remove('refreshing');
        }, 1000);
    }
}

// Refresh button
if (refreshBtnHeader) {
    refreshBtnHeader.addEventListener('click', handleRefresh);
}
if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefresh);
}

// Auto-refresh when page becomes visible (user switches tabs/windows)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Update date display and check if date changed
        updateDateDisplay();
        // Also refresh data to ensure it's up-to-date
        fetchDashboardData();
    }
});

// Auto-refresh when window gains focus
window.addEventListener('focus', () => {
    updateDateDisplay();
    fetchDashboardData();
});

// Check date periodically (every minute) to catch date changes
setInterval(() => {
    updateDateDisplay();
}, 60000); // Check every minute

// Logout button
logoutBtn.addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('siswa');
        window.location.href = 'index.html';
    }
});

// Initialize Supabase and setup realtime
async function initializeSupabase() {
    try {
        // Fetch Supabase config from backend
        const configResponse = await fetch(`${API_URL}/api/config`);
        if (!configResponse.ok) {
            console.warn('Failed to fetch Supabase config, realtime will be disabled');
            return;
        }
        
        const config = await configResponse.json();
        
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            console.warn('Supabase config incomplete, realtime will be disabled');
            return;
        }
        
        // Initialize Supabase client
        // Check if supabase is available (from CDN)
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            
            // EXPOSE CLIENT KE window (DEBUG ONLY)
            window.supabaseClient = supabaseClient;
            
            // Check if user is logged in to Supabase Auth (required for RLS)
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError || !user) {
                console.warn('User not logged in to Supabase Auth, attempting to sign in...');
                
                // Try to restore session from localStorage
                const supabaseEmail = localStorage.getItem('supabaseEmail');
                
                if (supabaseEmail) {
                    // FRONTEND HARUS LOGIN SUPABASE AUTH
                    // Passwordless OTP - paling gampang
                    const { data: otpData, error: otpError } = await supabaseClient.auth.signInWithOtp({
                        email: supabaseEmail // Format: ${nis}@siswa.local
                    });
                    
                    if (otpError) {
                        console.warn('⚠️ Supabase Auth OTP sign in failed:', otpError);
                        console.warn('RLS may not work correctly. Please check Supabase Auth configuration.');
                    } else {
                        console.log('✅ Supabase Auth OTP sent to:', supabaseEmail);
                        console.log('📌 Supabase otomatis simpan session setelah OTP verified');
                        console.log('📌 JWT Supabase dibuat, auth.jwt() jadi ADA');
                        
                        // Note: User needs to verify OTP from email
                        // For automatic flow, backend should handle session creation
                        // But for now, we'll wait for user to verify OTP
                    }
                    
                    // Check again after OTP attempt
                    const { data: { user: newUser }, error: newUserError } = await supabaseClient.auth.getUser();
                    if (newUserError || !newUser) {
                        console.warn('⚠️ User still not logged in to Supabase Auth');
                        console.warn('⚠️ User needs to verify OTP from email to complete login');
                        console.warn('⚠️ RLS will not work until user is logged in to Supabase Auth');
                    } else {
                        const nis = newUser.user_metadata?.nis;
                        const role = newUser.user_metadata?.role;
                        if (nis) {
                            console.log('✅ User logged in to Supabase Auth');
                            console.log('✅ NIS in metadata:', nis);
                            console.log('✅ Role in metadata:', role || 'not set');
                        } else {
                            console.warn('⚠️ NIS not found in user metadata, RLS may not work correctly');
                        }
                    }
                } else {
                    console.warn('⚠️ Supabase email not found in localStorage, RLS may not work');
                }
            } else {
                // User is already logged in, verify NIS and role are in metadata
                const nis = user.user_metadata?.nis;
                const role = user.user_metadata?.role;
                if (!nis) {
                    console.warn('⚠️ NIS not found in user metadata, RLS may not work correctly');
                } else if (!role) {
                    console.warn('⚠️ Role not found in user metadata, RLS may not work correctly');
                } else {
                    console.log('✅ User logged in to Supabase Auth');
                    console.log('✅ NIS in metadata:', nis);
                    console.log('✅ Role in metadata:', role);
                    console.log('✅ auth.jwt() is available for RLS');
                }
            }
            
            console.log('Supabase client initialized for realtime');
        } else {
            console.warn('Supabase library not loaded, realtime will be disabled');
        }
    } catch (error) {
        console.error('Error initializing Supabase:', error);
    }
}

// Setup realtime subscriptions
function setupRealtimeSubscriptions() {
    if (!supabaseClient || !currentUserData) {
        return;
    }
    
    // Clean up existing subscriptions
    if (actionSubscription) {
        actionSubscription.unsubscribe();
    }
    if (historySubscription) {
        historySubscription.unsubscribe();
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Subscribe to action table changes (for machine status)
    // Listen to ALL changes, not just today's - remove filter
    actionSubscription = supabaseClient
        .channel('action-changes-' + Date.now())
        .on(
            'postgres_changes',
            {
                event: '*', // INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'action'
                // NO FILTER - listen to all changes including status updates
            },
            (payload) => {
                console.log('🔄 Action table changed:', payload);
                console.log('Event:', payload.eventType);
                console.log('Old status:', payload.old?.status);
                console.log('New status:', payload.new?.status);
                // Always refresh to get latest machine status
                fetchDashboardData();
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Subscribed to action table - listening to ALL changes');
            } else {
                console.log('Action subscription status:', status);
            }
        });
    
    // Subscribe to history table changes (for absen status and history)
    if (currentUserData.rfid && currentUserData.nis) {
        historySubscription = supabaseClient
            .channel('history-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'history',
                    filter: `rfid=eq.${currentUserData.rfid}`
                },
                (payload) => {
                    console.log('History table changed:', payload);
                    // Refresh dashboard data
                    fetchDashboardData();
                    
                    // If on history page, refresh history
                    if (historyPage.classList.contains('active')) {
                        const selectedMonth = monthSelector.value || null;
                        fetchHistory(selectedMonth);
                    }
                    
                    // If on analytics page, refresh analytics
                    if (analyticsPage.classList.contains('active')) {
                        fetchAnalytics();
                    }
                }
            )
            .subscribe();
    }
    
    console.log('Realtime subscriptions setup complete');
}

// Cleanup subscriptions on page unload
window.addEventListener('beforeunload', () => {
    if (actionSubscription) {
        actionSubscription.unsubscribe();
    }
    if (historySubscription) {
        historySubscription.unsubscribe();
    }
});

// Initial load
async function initializeApp() {
    await initializeSupabase();
    await fetchDashboardData();
    // Setup realtime after user data is loaded
    setTimeout(() => {
        setupRealtimeSubscriptions();
    }, 1000);
}

initializeApp();

// Auto refresh every 30 seconds (as backup, realtime should handle most updates)
setInterval(() => {
    fetchDashboardData();
}, 30000);

// Navigation Functions
function switchPage(page) {
    if (page === 'dashboard') {
        dashboardTab.classList.add('active');
        historyTab.classList.remove('active');
        analyticsTab.classList.remove('active');
        dashboardPage.classList.add('active');
        historyPage.classList.remove('active');
        analyticsPage.classList.remove('active');
    } else if (page === 'history') {
        historyTab.classList.add('active');
        dashboardTab.classList.remove('active');
        analyticsTab.classList.remove('active');
        historyPage.classList.add('active');
        dashboardPage.classList.remove('active');
        analyticsPage.classList.remove('active');
        // Fetch history when switching to history page
        if (monthSelector.options.length === 1) {
            fetchHistory();
        }
    } else if (page === 'analytics') {
        analyticsTab.classList.add('active');
        dashboardTab.classList.remove('active');
        historyTab.classList.remove('active');
        analyticsPage.classList.add('active');
        dashboardPage.classList.remove('active');
        historyPage.classList.remove('active');
        // Fetch analytics when switching to analytics page
        fetchAnalytics();
    }
}

// Tab navigation
dashboardTab.addEventListener('click', () => switchPage('dashboard'));
historyTab.addEventListener('click', () => switchPage('history'));
analyticsTab.addEventListener('click', () => switchPage('analytics'));

// History Functions
async function fetchHistory(selectedMonth = null) {
    try {
        historyContent.innerHTML = `
            <div class="loading-cell">
                <div class="loading-boxes">
                    <div class="loading-box"></div>
                    <div class="loading-box"></div>
                    <div class="loading-box"></div>
                </div>
                <span>Memuat history...</span>
            </div>
        `;

        const url = selectedMonth 
            ? `${API_URL}/dashboard/history?bulan=${selectedMonth}`
            : `${API_URL}/dashboard/history`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await handleApiResponse(response);
        if (!data) return; // Error already handled

        // Populate month selector if available months are provided
        if (data.availableMonths && data.availableMonths.length > 0) {
            populateMonthSelector(data.availableMonths, selectedMonth);
        }

        if (data.history && data.history.length > 0) {
            renderHistory(data.history);
        } else {
            renderHistoryEmpty();
        }
    } catch (error) {
        console.error('Error fetching history:', error);
        historyContent.innerHTML = `
            <div class="error-message">
                ${error.message || 'Terjadi kesalahan saat memuat history'}
            </div>
        `;
    }
}

function populateMonthSelector(availableMonths, selectedMonth = null) {
    // Clear existing options except "Semua Bulan"
    while (monthSelector.options.length > 1) {
        monthSelector.remove(1);
    }

    // Add available months
    availableMonths.forEach(month => {
        const option = document.createElement('option');
        option.value = month.bulanKey;
        option.textContent = month.bulan;
        if (selectedMonth && month.bulanKey === selectedMonth) {
            option.selected = true;
        }
        monthSelector.appendChild(option);
    });
}

// Month selector change
monthSelector.addEventListener('change', (e) => {
    const selectedMonth = e.target.value || null;
    fetchHistory(selectedMonth);
});

function renderHistory(historyArray) {
    if (!historyArray || historyArray.length === 0) {
        renderHistoryEmpty();
        return;
    }

    let html = '';

    historyArray.forEach((monthData) => {
        html += `
            <div class="history-month-section">
                <h3 class="history-month-title">${monthData.bulan}</h3>
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Tanggal</th>
                            <th>Waktu</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        monthData.records.forEach((record) => {
            const tanggal = new Date(record.tanggal);
            const tanggalFormatted = tanggal.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            let waktuFormatted = record.waktu || '-';
            if (waktuFormatted !== '-') {
                try {
                    const waktuDate = new Date(record.waktu);
                    if (!isNaN(waktuDate.getTime())) {
                        waktuFormatted = waktuDate.toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });
                    }
                } catch (e) {
                    // Keep original format if parsing fails
                }
            }

            const statusLower = (record.status || '').toLowerCase();
            const statusClass = statusLower === 'hadir' ? 'hadir' : 
                              statusLower === 'sakit' ? 'sakit' : 
                              statusLower === 'izin' ? 'izin' : 
                              statusLower === 'alpha' ? 'alpha' : '';

            html += `
                <tr>
                    <td>${record.id}</td>
                    <td>${tanggalFormatted}</td>
                    <td>${waktuFormatted}</td>
                    <td>
                        <span class="status-badge-table ${statusClass}">${record.status || '-'}</span>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    });

    historyContent.innerHTML = html;
}

function renderHistoryEmpty() {
    historyContent.innerHTML = `
        <div class="history-empty">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3>Belum ada history absensi</h3>
            <p>History absensi akan muncul setelah kamu melakukan absen</p>
        </div>
    `;
}

// Analytics Functions
async function fetchAnalytics() {
    try {
        analyticsContent.innerHTML = `
            <div class="loading-cell">
                <div class="loading-boxes">
                    <div class="loading-box"></div>
                    <div class="loading-box"></div>
                    <div class="loading-box"></div>
                </div>
                <span>Memuat analytics...</span>
            </div>
        `;

        const response = await fetch(`${API_URL}/dashboard/analytics`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await handleApiResponse(response);
        if (!data) return; // Error already handled

        if (data.analytics && data.analytics.length > 0) {
            renderAnalytics(data.analytics, data.total);
        } else {
            renderAnalyticsEmpty();
        }
    } catch (error) {
        console.error('Error fetching analytics:', error);
        analyticsContent.innerHTML = `
            <div class="error-message">
                ${error.message || 'Terjadi kesalahan saat memuat analytics'}
            </div>
        `;
    }
}

function renderAnalytics(analyticsArray, total) {
    let html = '';

    // Store total data for modal
    window.analyticsTotalData = total;

    // Calculate percentages for total
    const totalAbsen = total.absenTercatat || 0;
    const totalAll = totalAbsen + (total.alpha || 0);
    const hadirPercent = totalAll > 0 ? ((total.hadir || 0) / totalAll * 100).toFixed(1) : 0;
    const sakitPercent = totalAll > 0 ? ((total.sakit || 0) / totalAll * 100).toFixed(1) : 0;
    const izinPercent = totalAll > 0 ? ((total.izin || 0) / totalAll * 100).toFixed(1) : 0;
    const alphaPercent = totalAll > 0 ? ((total.alpha || 0) / totalAll * 100).toFixed(1) : 0;

    // Total Summary Section - Total card on top, then grid below
    html += `
        <div class="analytics-section">
            <h4 class="analytics-section-title">Total Kehadiran 1 Tahun</h4>
            <div class="analytics-total-container">
                <div class="analytics-total-main-card">
                    <div class="analytics-total-label">Total</div>
                    <div class="analytics-total-value">${totalAll || 0}</div>
                </div>
                <div class="analytics-total-grid">
                    <div class="analytics-total-card hadir clickable" onclick="showAnalyticsDetail('total')" title="Klik untuk melihat detail">
                        <div class="analytics-total-label">Hadir</div>
                        <div class="analytics-total-value">${total.hadir || 0}</div>
                        <div class="analytics-total-percent">${hadirPercent}%</div>
                    </div>
                    <div class="analytics-total-card sakit clickable" onclick="showAnalyticsDetail('total')" title="Klik untuk melihat detail">
                        <div class="analytics-total-label">Sakit</div>
                        <div class="analytics-total-value">${total.sakit || 0}</div>
                        <div class="analytics-total-percent">${sakitPercent}%</div>
                    </div>
                    <div class="analytics-total-card izin clickable" onclick="showAnalyticsDetail('total')" title="Klik untuk melihat detail">
                        <div class="analytics-total-label">Izin</div>
                        <div class="analytics-total-value">${total.izin || 0}</div>
                        <div class="analytics-total-percent">${izinPercent}%</div>
                    </div>
                    <div class="analytics-total-card alpha">
                        <div class="analytics-total-label">Alpha</div>
                        <div class="analytics-total-value">${total.alpha || 0}</div>
                        <div class="analytics-total-percent">${alphaPercent}%</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Analytics Per Bulan - Simple and compact
    html += `
        <div class="analytics-section">
            <h4 class="analytics-section-title">Kehadiran Per Bulan</h4>
            <div class="analytics-monthly-list">
    `;

    analyticsArray.forEach((monthData) => {
        const monthTotal = (monthData.absenTercatat || 0) + (monthData.alpha || 0);
        const monthHadirPercent = monthTotal > 0 ? ((monthData.hadir || 0) / monthTotal * 100).toFixed(1) : 0;
        const monthSakitPercent = monthTotal > 0 ? ((monthData.sakit || 0) / monthTotal * 100).toFixed(1) : 0;
        const monthIzinPercent = monthTotal > 0 ? ((monthData.izin || 0) / monthTotal * 100).toFixed(1) : 0;
        const monthAlphaPercent = monthTotal > 0 ? ((monthData.alpha || 0) / monthTotal * 100).toFixed(1) : 0;
        
        // Store month data for modal
        window[`analyticsMonthData_${monthData.bulanKey}`] = monthData;
        
        html += `
            <div class="analytics-monthly-item">
                <div class="analytics-monthly-header">
                    <h5 class="analytics-monthly-title">${monthData.bulan}</h5>
                    <span class="analytics-monthly-total">Total: ${monthTotal || 0}</span>
                </div>
                <div class="analytics-monthly-details">
                    <div class="analytics-monthly-detail hadir clickable" onclick="showAnalyticsDetail('${monthData.bulanKey}')" title="Klik untuk melihat detail">
                        <span class="detail-label">Hadir:</span>
                        <span class="detail-value">${monthData.hadir || 0}</span>
                        <span class="detail-percent">(${monthHadirPercent}%)</span>
                    </div>
                    <div class="analytics-monthly-detail sakit clickable" onclick="showAnalyticsDetail('${monthData.bulanKey}')" title="Klik untuk melihat detail">
                        <span class="detail-label">Sakit:</span>
                        <span class="detail-value">${monthData.sakit || 0}</span>
                        <span class="detail-percent">(${monthSakitPercent}%)</span>
                    </div>
                    <div class="analytics-monthly-detail izin clickable" onclick="showAnalyticsDetail('${monthData.bulanKey}')" title="Klik untuk melihat detail">
                        <span class="detail-label">Izin:</span>
                        <span class="detail-value">${monthData.izin || 0}</span>
                        <span class="detail-percent">(${monthIzinPercent}%)</span>
                    </div>
                    <div class="analytics-monthly-detail alpha">
                        <span class="detail-label">Alpha:</span>
                        <span class="detail-value">${monthData.alpha || 0}</span>
                        <span class="detail-percent">(${monthAlphaPercent}%)</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    analyticsContent.innerHTML = html;
}

// Show analytics detail modal
window.showAnalyticsDetail = function(type) {
    let detailData;
    let title;
    
    if (type === 'total') {
        detailData = window.analyticsTotalData;
        title = 'Detail Total Semua Bulan';
    } else {
        detailData = window[`analyticsMonthData_${type}`];
        title = `Detail ${detailData.bulan}`;
    }
    
    if (!detailData) return;
    
    const modal = document.getElementById('analyticsDetailModal');
    const modalTitle = document.getElementById('analyticsDetailTitle');
    const modalBody = document.getElementById('analyticsDetailBody');
    
    modalTitle.textContent = title;
    
    modalBody.innerHTML = `
        <div class="analytics-detail-grid">
            <div class="analytics-detail-item">
                <span class="analytics-detail-label">Hadir</span>
                <span class="analytics-detail-value hadir">${detailData.hadir || 0}</span>
            </div>
            <div class="analytics-detail-item">
                <span class="analytics-detail-label">Sakit</span>
                <span class="analytics-detail-value sakit">${detailData.sakit || 0}</span>
            </div>
            <div class="analytics-detail-item">
                <span class="analytics-detail-label">Izin</span>
                <span class="analytics-detail-value izin">${detailData.izin || 0}</span>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
};

// Close modal
window.closeAnalyticsDetail = function() {
    const modal = document.getElementById('analyticsDetailModal');
    modal.classList.remove('active');
};

// Close modal when clicking outside
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('analyticsDetailModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAnalyticsDetail();
            }
        });
    }
    
    // Close modal with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeAnalyticsDetail();
        }
    });
});

function renderAnalyticsEmpty() {
    analyticsContent.innerHTML = `
        <div class="analytics-empty">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3V21H21M7 16L12 11L16 15L21 10M21 10H16M21 10V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3>Belum ada data analytics</h3>
            <p>Data analytics akan muncul setelah kamu melakukan absen</p>
        </div>
    `;
}

