const API_URL = 'http://localhost:5000/auth';

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const errorMessage = document.getElementById('errorMessage');
const buttonText = loginButton.querySelector('.button-text');
const buttonLoader = loginButton.querySelector('.button-loader');

// Handle form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nama = document.getElementById('nama').value.trim();
    const nis = document.getElementById('nis').value.trim();
    
    // Hide previous error
    errorMessage.style.display = 'none';
    
    // Show loading state
    setLoading(true);
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nama, nis }),
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            // If not JSON, get text response
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
            
            // Show success animation
            document.querySelector('.login-card').classList.add('success');
            
            // Redirect to dashboard or home page
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
        errorMessage.textContent = errorMsg;
        errorMessage.style.display = 'block';
        
        // Shake animation
        errorMessage.style.animation = 'none';
        setTimeout(() => {
            errorMessage.style.animation = 'shake 0.3s ease';
        }, 10);
    } finally {
        setLoading(false);
    }
});

// Set loading state
function setLoading(loading) {
    if (loading) {
        loginButton.disabled = true;
        buttonText.style.opacity = '0';
        buttonLoader.style.display = 'flex';
    } else {
        loginButton.disabled = false;
        buttonText.style.opacity = '1';
        buttonLoader.style.display = 'none';
    }
}

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        // User is already logged in, redirect to dashboard
        window.location.href = 'dashboard.html';
    }
});

