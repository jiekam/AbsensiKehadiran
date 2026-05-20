import JWT from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

export const login = async (req, res) => {
    try {
        const { nama, nis, password, isAdmin } = req.body;

        if (!nama || !nis) {
            return res.status(400).json({ message : 'Nama dan NIS wajib diisi' });
        }

        let user = null;
        let isFromMaster = false;

        // 1. First check master_users (for exhibition visitors/new users)
        const { data: masterUser, error: masterError } = await supabase
            .from('master_users')
            .select('*')
            .eq('nama', nama)
            .eq('nomor_induk', nis)
            .maybeSingle();

        if (masterUser) {
            user = {
                ...masterUser,
                nis: masterUser.nomor_induk // Map nomor_induk to nis for compatibility
            };
            isFromMaster = true;
        } else {
            // 2. If not found, check siswa_xirpl (existing students)
            const { data: siswa, error: siswaError } = await supabase
                .from('siswa_xirpl')
                .select('*')
                .eq('nama', nama)
                .eq('nis', nis)
                .maybeSingle();
            
            if (siswa) {
                user = siswa;
            }
        }

        if (!user) {
            return res.status(401).json({ message : 'Nama atau NIS/Nomor Induk salah' });
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
            if (!user.role || user.role.toLowerCase() !== 'admin') {
                return res.status(403).json({ message : 'Anda tidak memiliki akses admin' });
            }

            // Check if password is provided
            if (!password) {
                return res.status(400).json({ message : 'Password wajib diisi untuk login admin' });
            }

            // Check if password matches
            if (!user.password || user.password !== password) {
                return res.status(401).json({ message : 'Password salah' });
            }

            // Check if JWT_SECRET is set
            if (!process.env.JWT_SECRET) {
                console.error('JWT_SECRET is not defined in environment variables');
                return res.status(500).json({ message: 'Konfigurasi server tidak lengkap' });
            }

            // Create or update user in Supabase Auth with NIS and ROLE in metadata (for admin)
            const email = `${user.nis}@siswa.local`;
            
            try {
                const { data: existingUsers } = await supabase.auth.admin.listUsers();
                const existingUser = existingUsers?.users?.find(u => u.email === email);
                
                if (existingUser) {
                    await supabase.auth.admin.updateUserById(
                        existingUser.id,
                        {
                            user_metadata: {
                                nis: user.nis,
                                nama: user.nama,
                                id: user.id,
                                role: user.role || 'admin'
                            }
                        }
                    );
                } else {
                    await supabase.auth.admin.createUser({
                        email: email,
                        password: `admin_${user.nis}_${Date.now()}`,
                        email_confirm: true,
                        user_metadata: {
                            nis: user.nis,
                            nama: user.nama,
                            id: user.id,
                            role: user.role || 'admin'
                        }
                    });
                }
            } catch (supabaseError) {
                console.error('Error creating/updating Supabase Auth user for admin:', supabaseError);
            }

            // Generate token for admin
            const token = JWT.sign(
                {
                    id: user.id,
                    nama: user.nama,
                    nis: user.nis,
                    role: 'admin'
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            return res.json({
                message: 'Login admin berhasil',
                token,
                siswa: user,
                isAdmin: true,
                supabaseEmail: email
            });
        }

        // Regular student login (no password required)
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not defined in environment variables');
            return res.status(500).json({ message: 'Konfigurasi server tidak lengkap' });
        }

        const email = `${user.nis}@siswa.local`;
        let supabaseSessionToken = null;
        
        try {
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find(u => u.email === email);
            
            let authUserId = null;
            
            if (existingUser) {
                const { data: updatedUser } = await supabase.auth.admin.updateUserById(
                    existingUser.id,
                    {
                        user_metadata: {
                            nis: user.nis,
                            nama: user.nama,
                            id: user.id,
                            role: user.role || 'siswa'
                        }
                    }
                );
                authUserId = existingUser.id;
            } else {
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: email,
                    password: `siswa_${user.nis}_${Date.now()}`,
                    email_confirm: true,
                    user_metadata: {
                        nis: user.nis,
                        nama: user.nama,
                        id: user.id,
                        role: user.role || 'siswa'
                    }
                });
                
                if (!createError && newUser) {
                    authUserId = newUser.user.id;
                }
            }
            
            if (authUserId) {
                const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
                    type: 'magiclink',
                    email: email
                });
                
                if (!sessionError && sessionData) {
                    supabaseSessionToken = sessionData.properties?.hashed_token || null;
                }
            }
        } catch (supabaseError) {
            console.error('Error creating/updating Supabase Auth user:', supabaseError);
        }

        // Generate JWT token
        const token = JWT.sign(
            {
                id: user.id,
                nama: user.nama,
                nis: user.nis
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
            
        return res.json({
            message: 'Login berhasil',
            token,
            siswa: user,
            isAdmin: false,
            supabaseEmail: email,
            supabaseSessionToken: supabaseSessionToken
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};