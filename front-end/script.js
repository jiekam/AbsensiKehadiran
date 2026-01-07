const API_URL = 'https://absensikehadiran-production.up.railway.app';

// Get elements
const loginLoadingOverlay = document.getElementById('loginLoadingOverlay');
const memeModal = document.getElementById('memeModal');
const memeCloseBtn = document.getElementById('memeCloseBtn');
const siswaBtn = document.getElementById('siswaBtn');
const adminBtn = document.getElementById('adminBtn');
const siswaForm = document.getElementById('siswaForm');
const adminForm = document.getElementById('adminForm');
const loginFormSiswa = document.getElementById('loginFormSiswa');
const loginFormAdmin = document.getElementById('loginFormAdmin');
const errorMessageSiswa = document.getElementById('errorMessageSiswa');
const errorMessageAdmin = document.getElementById('errorMessageAdmin');
const loginButtonSiswa = document.getElementById('loginButtonSiswa');
const loginButtonAdmin = document.getElementById('loginButtonAdmin');
const buttonTextSiswa = loginButtonSiswa.querySelector('.button-text');
const buttonLoaderSiswa = loginButtonSiswa.querySelector('.button-loader');
const buttonTextAdmin = loginButtonAdmin.querySelector('.button-text');
const buttonLoaderAdmin = loginButtonAdmin.querySelector('.button-loader');

// Show/Hide Loading
function showLoading(text = 'Memuat...') {
    if (loginLoadingOverlay) {
        const loadingText = loginLoadingOverlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
        loginLoadingOverlay.classList.remove('hidden');
    }
}

function hideLoading() {
    if (loginLoadingOverlay) {
        loginLoadingOverlay.classList.add('hidden');
    }
}

// Show/Hide Meme Modal
function showMemeModal() {
    if (memeModal) {
        memeModal.classList.add('active');
    }
}

function hideMemeModal() {
    if (memeModal) {
        memeModal.classList.remove('active');
    }
}

// Close meme modal
if (memeCloseBtn) {
    memeCloseBtn.addEventListener('click', hideMemeModal);
}

// Close meme modal when clicking outside
if (memeModal) {
    memeModal.addEventListener('click', (e) => {
        if (e.target === memeModal) {
            hideMemeModal();
        }
    });
}

// Switch between forms
function switchForm(type) {
    const formsWrapper = document.querySelector('.forms-wrapper');
    
    if (type === 'siswa') {
        siswaBtn.classList.add('active');
        adminBtn.classList.remove('active');
        siswaForm.classList.add('active');
        adminForm.classList.remove('active');
    } else {
        adminBtn.classList.add('active');
        siswaBtn.classList.remove('active');
        adminForm.classList.add('active');
        siswaForm.classList.remove('active');
    }
    
    // Scroll to top when switching forms
    if (formsWrapper) {
        formsWrapper.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
    
    // Clear error messages
    errorMessageSiswa.style.display = 'none';
    errorMessageAdmin.style.display = 'none';
}

// Event listeners for switcher
siswaBtn.addEventListener('click', () => switchForm('siswa'));
adminBtn.addEventListener('click', () => switchForm('admin'));

// Set loading state
function setLoading(loading, isAdmin = false) {
    const button = isAdmin ? loginButtonAdmin : loginButtonSiswa;
    const buttonText = isAdmin ? buttonTextAdmin : buttonTextSiswa;
    const buttonLoader = isAdmin ? buttonLoaderAdmin : buttonLoaderSiswa;
    
    if (loading) {
        button.disabled = true;
        buttonText.style.opacity = '0';
        buttonLoader.style.display = 'flex';
    } else {
        button.disabled = false;
        buttonText.style.opacity = '1';
        buttonLoader.style.display = 'none';
    }
}

// Handle student login form submission
loginFormSiswa.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nama = document.getElementById('namaSiswa').value.trim();
    const nis = document.getElementById('nisSiswa').value.trim();
    
    // Hide previous error
    errorMessageSiswa.style.display = 'none';
    
    // Show loading overlay
    showLoading('Memproses login...');
    
    // Show loading state
    setLoading(true, false);
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nama, nis, isAdmin: false }),
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error('Server mengembalikan respons yang tidak valid. Pastikan backend berjalan dengan benar.');
        }
        
        if (!response.ok) {
            throw new Error(data.message || 'Login gagal');
        }
        
        // Success
        if (data.token) {
            // Store token in localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('siswa', JSON.stringify(data.siswa));
            localStorage.removeItem('isAdmin');
            
            // Show success animation
            siswaForm.classList.add('success');
            
            // Show loading with success message
            showLoading('Login berhasil! Mengalihkan...');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        }
    } catch (error) {
        // Handle different types of errors
        let errorMsg = 'Terjadi kesalahan. Silakan coba lagi.';
        
        if (error.message) {
            errorMsg = error.message;
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMsg = 'Tidak dapat terhubung ke server. Pastikan backend berjalan di http://localhost:5000';
        }
        
        // Show error message
        errorMessageSiswa.textContent = errorMsg;
        errorMessageSiswa.style.display = 'block';
        
        // Shake animation
        errorMessageSiswa.style.animation = 'none';
        setTimeout(() => {
            errorMessageSiswa.style.animation = 'shake 0.3s ease';
        }, 10);
    } finally {
        setLoading(false, false);
        hideLoading();
    }
});

// Handle admin login form submission
loginFormAdmin.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nama = document.getElementById('namaAdmin').value.trim();
    const nis = document.getElementById('nisAdmin').value.trim();
    const password = document.getElementById('passwordAdmin').value.trim();
    
    // Hide previous error
    errorMessageAdmin.style.display = 'none';
    
    // Validate password
    if (!password) {
        errorMessageAdmin.textContent = 'Password wajib diisi untuk login admin';
        errorMessageAdmin.style.display = 'block';
        return;
    }
    
    // Show loading overlay
    showLoading('Memproses login admin...');
    
    // Show loading state
    setLoading(true, true);
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nama, nis, password, isAdmin: true }),
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error('Server mengembalikan respons yang tidak valid. Pastikan backend berjalan dengan benar.');
        }
        
        if (!response.ok) {
            // Check if it's the meme case (password admin123 with non-admin role)
            if (data.showMeme && password === 'admin123') {
                hideLoading();
                setLoading(false, true);
                showMemeModal();
                return;
            }
            throw new Error(data.message || 'Login gagal');
        }
        
        // Success
        if (data.token) {
            // Store token in localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('siswa', JSON.stringify(data.siswa));
            localStorage.setItem('isAdmin', 'true');
            
            // Show success animation
            adminForm.classList.add('success');
            
            // Show loading with success message
            showLoading('Login berhasil! Mengalihkan...');
            
            // Redirect to admin dashboard
            setTimeout(() => {
                window.location.href = 'admin-dashboard.html';
            }, 500);
        }
    } catch (error) {
        // Handle different types of errors
        let errorMsg = 'Terjadi kesalahan. Silakan coba lagi.';
        
        if (error.message) {
            errorMsg = error.message;
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMsg = 'Tidak dapat terhubung ke server. Pastikan backend berjalan di http://localhost:5000';
        }
        
        // Show error message
        errorMessageAdmin.textContent = errorMsg;
        errorMessageAdmin.style.display = 'block';
        
        // Shake animation
        errorMessageAdmin.style.animation = 'none';
        setTimeout(() => {
            errorMessageAdmin.style.animation = 'shake 0.3s ease';
        }, 10);
    } finally {
        setLoading(false, true);
        hideLoading();
    }
});

// Cursor Light Effect
let cursorLight = null;
let cursorTrailContainer = null;
let mouseX = 0;
let mouseY = 0;
let lastTrailX = 0;
let lastTrailY = 0;

function initCursorLight() {
    cursorLight = document.getElementById('cursorLight');
    cursorTrailContainer = document.getElementById('cursorTrailContainer');
    if (!cursorLight || !cursorTrailContainer) return;

    // Track mouse movement
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Update cursor position immediately
        cursorLight.style.left = mouseX + 'px';
        cursorLight.style.top = mouseY + 'px';
        
        // Check if cursor moved enough to spawn new trail
        const distance = Math.sqrt(
            Math.pow(mouseX - lastTrailX, 2) + Math.pow(mouseY - lastTrailY, 2)
        );
        
        // Spawn trail box every 15px movement for smooth trail
        if (distance > 15) {
            spawnTrail(mouseX, mouseY);
            lastTrailX = mouseX;
            lastTrailY = mouseY;
        }
    });

    // Hide light when mouse leaves window
    document.addEventListener('mouseleave', () => {
        if (cursorLight) {
            cursorLight.style.opacity = '0';
        }
    });

    // Show light when mouse enters window
    document.addEventListener('mouseenter', () => {
        if (cursorLight) {
            cursorLight.style.opacity = '1';
        }
    });
}

function spawnTrail(x, y) {
    if (!cursorTrailContainer) return;
    
    const trail = document.createElement('div');
    trail.className = 'cursor-trail';
    trail.style.left = x + 'px';
    trail.style.top = y + 'px';
    
    cursorTrailContainer.appendChild(trail);
    
    // Remove trail after animation completes
    setTimeout(() => {
        if (trail.parentNode) {
            trail.parentNode.removeChild(trail);
        }
    }, 1500);
}

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', () => {
    // Show loading on page load
    showLoading('Memuat halaman...');
    
    // Simulate page load time
    setTimeout(() => {
        const token = localStorage.getItem('token');
        const isAdmin = localStorage.getItem('isAdmin');
        
        if (token) {
            // User is already logged in, redirect to appropriate dashboard
            showLoading('Mengalihkan...');
            if (isAdmin === 'true') {
                window.location.href = 'admin-dashboard.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        } else {
            // Hide loading after page is ready
            setTimeout(() => {
                hideLoading();
                // Initialize cursor light effect
                initCursorLight();
            }, 300);
        }
    }, 500);
});
