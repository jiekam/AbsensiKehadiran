import JWT from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

export const login = async (req, res) => {
    try {
        const { nama, nis, password, isAdmin } = req.body;

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

        // Check if user is trying to login as admin
        if (isAdmin) {
            // Special check for password "admin123" - show meme for anyone (student or admin)
            if (password === 'admin123') {
                return res.status(403).json({ 
                    message : 'Password tidak valid',
                    showMeme: true
                });
            }
            
            // Check if role is admin (for other passwords)
            if (!siswa.role || siswa.role.toLowerCase() !== 'admin') {
                return res.status(403).json({ message : 'Anda tidak memiliki akses admin' });
            }

            // Check if password is provided
            if (!password) {
                return res.status(400).json({ message : 'Password wajib diisi untuk login admin' });
            }

            // Check if password matches
            if (!siswa.password || siswa.password !== password) {
                return res.status(401).json({ message : 'Password salah' });
            }

            // Check if JWT_SECRET is set
            if (!process.env.JWT_SECRET) {
                console.error('JWT_SECRET is not defined in environment variables');
                return res.status(500).json({ message: 'Konfigurasi server tidak lengkap' });
            }

            // Generate token for admin
            const token = JWT.sign(
                {
                    id: siswa.id,
                    nama: siswa.nama,
                    nis: siswa.nis,
                    role: 'admin'
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            return res.json({
                message: 'Login admin berhasil',
                token,
                siswa,
                isAdmin: true
            });
        }

        // Regular student login (no password required)
        // Check if JWT_SECRET is set
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not defined in environment variables');
            return res.status(500).json({ message: 'Konfigurasi server tidak lengkap' });
        }

        // Create or update user in Supabase Auth with NIS in metadata
        // This is required for RLS to work with auth.jwt()
        // User must be logged in to Supabase Auth for RLS to work
        const email = `${siswa.nis}@siswa.local`; // Use NIS as email identifier
        let supabaseSessionToken = null;
        
        try {
            // Check if user exists
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find(u => u.email === email);
            
            let authUserId = null;
            
            if (existingUser) {
                // Update existing user metadata with NIS (required for RLS)
                const { data: updatedUser } = await supabase.auth.admin.updateUserById(
                    existingUser.id,
                    {
                        user_metadata: {
                            nis: siswa.nis,
                            nama: siswa.nama,
                            id: siswa.id
                        }
                    }
                );
                authUserId = existingUser.id;
            } else {
                // Create new user with NIS in metadata
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: email,
                    password: `siswa_${siswa.nis}_${Date.now()}`, // Temporary password
                    email_confirm: true,
                    user_metadata: {
                        nis: siswa.nis,
                        nama: siswa.nama,
                        id: siswa.id
                    }
                });
                
                if (!createError && newUser) {
                    authUserId = newUser.user.id;
                }
            }
            
            // Generate session token for frontend
            if (authUserId) {
                const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
                    type: 'magiclink',
                    email: email
                });
                
                if (!sessionError && sessionData) {
                    // Extract token from the link
                    supabaseSessionToken = sessionData.properties?.hashed_token || null;
                }
            }
        } catch (supabaseError) {
            console.error('Error creating/updating Supabase Auth user:', supabaseError);
            // Continue with login even if Supabase Auth fails (for backward compatibility)
        }

        // Generate JWT token
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
            isAdmin: false,
            supabaseEmail: email, // Email for Supabase Auth
            supabaseSessionToken: supabaseSessionToken // Session token for frontend to set session
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};