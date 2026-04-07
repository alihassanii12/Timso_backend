import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

export const initializeDatabase = async () => {
    try {
        console.log('🔄 Starting database initialization...');
        
        // ============================================================
        // EXISTING TABLES (Users, Blacklisted Tokens, Login History, etc.)
        // ============================================================
        
        // Create users table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                refresh_token TEXT,
                email_verified BOOLEAN DEFAULT false,
                email_verification_token TEXT,
                email_verification_expires TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                last_failed_login TIMESTAMP,
                failed_login_attempts INTEGER DEFAULT 0,
                locked_until TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                role VARCHAR(50) DEFAULT 'user',
                profile_picture TEXT,
                phone_number VARCHAR(20),
                date_of_birth DATE,
                address TEXT,
                two_factor_enabled BOOLEAN DEFAULT false,
                two_factor_secret TEXT,
                last_password_change TIMESTAMP,
                password_history TEXT[] DEFAULT ARRAY[]::TEXT[],
                notes TEXT
            )
        `);
        console.log('✅ Users table created or already exists');

        // Create blacklisted_tokens table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS blacklisted_tokens (
                id SERIAL PRIMARY KEY,
                token TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Blacklisted tokens table created or already exists');

        // Create login_history table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS login_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address INET,
                user_agent TEXT,
                success BOOLEAN DEFAULT true,
                device_type VARCHAR(50),
                browser VARCHAR(100),
                operating_system VARCHAR(100),
                location VARCHAR(255)
            )
        `);
        console.log('✅ Login history table created or already exists');

        // Create sessions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                session_token TEXT UNIQUE NOT NULL,
                device_info TEXT,
                ip_address INET,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            )
        `);
        console.log('✅ Sessions table created or already exists');

        // Create audit_logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50),
                entity_id INTEGER,
                old_data JSONB,
                new_data JSONB,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Audit logs table created or already exists');

        // Create user_roles table for more complex role management
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_roles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(50) NOT NULL,
                assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                UNIQUE(user_id, role)
            )
        `);
        console.log('✅ User roles table created or already exists');

        // Create permissions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS permissions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                category VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Permissions table created or already exists');

        // Create role_permissions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                id SERIAL PRIMARY KEY,
                role VARCHAR(50) NOT NULL,
                permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(role, permission_id)
            )
        `);
        console.log('✅ Role permissions table created or already exists');

        // Create notifications table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT,
                data JSONB,
                is_read BOOLEAN DEFAULT false,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Notifications table created or already exists');

        // Create backup_codes table for 2FA
        await pool.query(`
            CREATE TABLE IF NOT EXISTS backup_codes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                code VARCHAR(10) NOT NULL,
                is_used BOOLEAN DEFAULT false,
                used_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )
        `);
        console.log('✅ Backup codes table created or already exists');

        // ============================================================
        // TIMSO DASHBOARD — New Tables Migration
        // ============================================================

        // 1. ATTENDANCE — user daily status (office/remote/away)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status      VARCHAR(20) NOT NULL CHECK (status IN ('office','remote','away','sick','vacation')),
                note        TEXT,
                date        DATE NOT NULL DEFAULT CURRENT_DATE,
                checked_in_at  TIMESTAMP DEFAULT NOW(),
                updated_at  TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, date)
            )
        `);
        console.log('✅ Attendance table created or already exists');

        // 2. DAY SWAPS — swap requests
        await pool.query(`
            CREATE TABLE IF NOT EXISTS day_swaps (
                id              SERIAL PRIMARY KEY,
                requester_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                from_date       DATE NOT NULL,
                to_date         DATE NOT NULL,
                reason          TEXT,
                status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
                created_at      TIMESTAMP DEFAULT NOW(),
                updated_at      TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Day swaps table created or already exists');

        // 3. COMPANIES — company registration
        await pool.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id              SERIAL PRIMARY KEY,
                name            VARCHAR(255) UNIQUE NOT NULL,
                admin_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                description     TEXT,
                created_at      TIMESTAMP DEFAULT NOW(),
                updated_at      TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Companies table created or already exists');

        // 4. COMPANY APPLICATIONS — user applications to join a company
        await pool.query(`
            CREATE TABLE IF NOT EXISTS company_applications (
                id              SERIAL PRIMARY KEY,
                user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
                created_at      TIMESTAMP DEFAULT NOW(),
                updated_at      TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, company_id)
            )
        `);
        console.log('✅ Company applications table created or already exists');

        // 5. UPDATE USERS TABLE — add company_id
        try {
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`);
            console.log('✅ Added company_id to users table');
        } catch (err) {
            console.log('⚠️ company_id already exists in users table or error occurred:', err.message);
        }

        // 6. ACTIVITY LOG — team ke status changes
        await pool.query(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action      TEXT NOT NULL,
                icon        VARCHAR(10),
                created_at  TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Activity log table created or already exists');

        // ============================================================
        // TASKS TABLE — Task Management
        // ============================================================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id              SERIAL PRIMARY KEY,
                title           VARCHAR(255) NOT NULL,
                description     TEXT,
                assigned_to     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                assigned_by     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status          VARCHAR(20) NOT NULL DEFAULT 'todo'
                                CHECK (status IN ('todo','in_progress','done')),
                priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                                CHECK (priority IN ('low','medium','high')),
                due_date        DATE,
                created_at      TIMESTAMP DEFAULT NOW(),
                updated_at      TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Tasks table created or already exists');

        // ============================================================
        // INDEXES FOR ALL TABLES
        // ============================================================
        
        await pool.query(`
            -- Attendance indexes
            CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
            CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
            CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
            
            -- Day swaps indexes
            CREATE INDEX IF NOT EXISTS idx_day_swaps_requester ON day_swaps(requester_id);
            CREATE INDEX IF NOT EXISTS idx_day_swaps_status ON day_swaps(status);
            CREATE INDEX IF NOT EXISTS idx_day_swaps_created_at ON day_swaps(created_at);
            
            -- Activity log indexes
            CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
            CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

            -- Tasks indexes
            CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
            CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
            CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
            CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
        `);
        console.log('✅ All indexes created or already exist');

        // Add reset password fields to users table
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS reset_password_token TEXT,
            ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP,
            ADD COLUMN IF NOT EXISTS reset_password_attempts INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS reset_password_requested_at TIMESTAMP
        `);
        console.log('✅ Reset password fields added');

        // Add email verification tracking
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS email_verification_attempts INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS email_verification_requested_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP
        `);
        console.log('✅ Email verification fields added');

        // Create indexes for better performance (existing indexes)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_refresh_token ON users(refresh_token);
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
            CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
            CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_token ON blacklisted_tokens(token);
            CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);
            CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
            CREATE INDEX IF NOT EXISTS idx_login_history_login_time ON login_history(login_time);
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
        `);
        console.log('✅ Additional indexes created or already exist');

        // Create updated_at trigger function
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);

        // Create triggers
        await pool.query(`
            DO $$
            BEGIN
                -- Users table trigger
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
                    CREATE TRIGGER update_users_updated_at
                        BEFORE UPDATE ON users
                        FOR EACH ROW
                        EXECUTE FUNCTION update_updated_at_column();
                END IF;
                
                -- Attendance table trigger
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_attendance_updated_at') THEN
                    CREATE TRIGGER update_attendance_updated_at
                        BEFORE UPDATE ON attendance
                        FOR EACH ROW
                        EXECUTE FUNCTION update_updated_at_column();
                END IF;
                
                -- Day swaps table trigger
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_day_swaps_updated_at') THEN
                    CREATE TRIGGER update_day_swaps_updated_at
                        BEFORE UPDATE ON day_swaps
                        FOR EACH ROW
                        EXECUTE FUNCTION update_updated_at_column();
                END IF;

                -- Tasks table trigger
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tasks_updated_at') THEN
                    CREATE TRIGGER update_tasks_updated_at
                        BEFORE UPDATE ON tasks
                        FOR EACH ROW
                        EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END$$;
        `);
        console.log('✅ All triggers created or already exist');

        // Insert default permissions
        await pool.query(`
            INSERT INTO permissions (name, description, category) VALUES
            ('user.create', 'Create new users', 'User Management'),
            ('user.read', 'View user details', 'User Management'),
            ('user.update', 'Update user information', 'User Management'),
            ('user.delete', 'Delete users', 'User Management'),
            ('user.manage_roles', 'Manage user roles', 'User Management'),
            ('content.create', 'Create content', 'Content Management'),
            ('content.read', 'View content', 'Content Management'),
            ('content.update', 'Update content', 'Content Management'),
            ('content.delete', 'Delete content', 'Content Management'),
            ('settings.view', 'View settings', 'Settings'),
            ('settings.update', 'Update settings', 'Settings'),
            ('reports.view', 'View reports', 'Reports'),
            ('reports.export', 'Export reports', 'Reports'),
            ('audit.view', 'View audit logs', 'Audit'),
            ('admin.access', 'Access admin panel', 'Admin'),
            ('attendance.view', 'View attendance', 'Attendance'),
            ('attendance.update', 'Update attendance', 'Attendance'),
            ('day_swaps.request', 'Request day swaps', 'Day Swaps'),
            ('day_swaps.approve', 'Approve day swaps', 'Day Swaps'),
            ('activity_log.view', 'View activity log', 'Activity'),
            ('tasks.create', 'Create tasks', 'Task Management'),
            ('tasks.read', 'View tasks', 'Task Management'),
            ('tasks.update', 'Update tasks', 'Task Management'),
            ('tasks.delete', 'Delete tasks', 'Task Management'),
            ('tasks.assign', 'Assign tasks to users', 'Task Management')
            ON CONFLICT (name) DO NOTHING
        `);
        console.log('✅ Default permissions inserted');

        // Insert role permissions
        await pool.query(`
            -- Admin gets all permissions
            INSERT INTO role_permissions (role, permission_id)
            SELECT 'admin', id FROM permissions
            ON CONFLICT (role, permission_id) DO NOTHING;

            -- User gets basic permissions
            INSERT INTO role_permissions (role, permission_id)
            SELECT 'user', id FROM permissions 
            WHERE name IN ('user.read', 'content.read', 'attendance.view', 'attendance.update', 'day_swaps.request', 'activity_log.view', 'tasks.read', 'tasks.update')
            ON CONFLICT (role, permission_id) DO NOTHING;
        `);
        console.log('✅ Role permissions inserted');

        // Create admin user if not exists
        await createAdminUser();

        console.log('🎉 Database initialization completed successfully');
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
};

// Function to create admin user
const createAdminUser = async () => {
    try {
        console.log('👤 Checking for admin user...');

        const adminEmail = 'admin@timeso.com';
        const adminUsername = 'admin';
        const adminPassword = 'Admin@123456';
        const adminFullName = 'System Administrator';

        // Check if admin already exists
        const existingAdmin = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2',
            [adminEmail, adminUsername]
        );

        if (existingAdmin.rows.length > 0) {
            const admin = existingAdmin.rows[0];
            
            // Update to admin role if not already
            if (admin.role !== 'admin') {
                await pool.query(
                    'UPDATE users SET role = $1 WHERE id = $2',
                    ['admin', admin.id]
                );
                console.log('✅ Existing user updated to admin role!');
            } else {
                console.log('✅ Admin user already exists!');
            }

            // Add to user_roles table
            await pool.query(`
                INSERT INTO user_roles (user_id, role, assigned_by)
                VALUES ($1, 'admin', $1)
                ON CONFLICT (user_id, role) DO NOTHING
            `, [admin.id]);

            console.log('Admin details:');
            console.log(`Email: ${adminEmail}`);
            console.log(`Username: ${adminUsername}`);
            console.log(`Password: ${adminPassword}`);
            
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        // Insert admin user
        const result = await pool.query(`
            INSERT INTO users (
                email, 
                username, 
                password, 
                full_name, 
                role, 
                email_verified, 
                is_active,
                created_at,
                email_verified_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING id, email, username, role
        `, [adminEmail, adminUsername, hashedPassword, adminFullName, 'admin', true, true]);

        const adminId = result.rows[0].id;

        // Add to user_roles table
        await pool.query(`
            INSERT INTO user_roles (user_id, role, assigned_by)
            VALUES ($1, 'admin', $1)
        `, [adminId]);

        // Create welcome notification
        await pool.query(`
            INSERT INTO notifications (user_id, type, title, message)
            VALUES ($1, 'welcome', 'Welcome to Admin Panel', 'Your admin account has been created successfully!')
        `, [adminId]);

        console.log('✅ Admin user created successfully!');
        console.log('Admin details:');
        console.log(`ID: ${adminId}`);
        console.log(`Email: ${adminEmail}`);
        console.log(`Username: ${adminUsername}`);
        console.log(`Password: ${adminPassword}`);
        console.log(`Role: ${result.rows[0].role}`);

        // Log to audit
        await pool.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
            VALUES ($1, 'CREATE_ADMIN', 'users', $1, $2::jsonb)
        `, [adminId, JSON.stringify({ email: adminEmail, username: adminUsername, role: 'admin' })]);

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    }
};

// Function to cleanup expired data
export const cleanupExpiredData = async () => {
    try {
        console.log('🧹 Cleaning up expired data...');

        // Delete expired blacklisted tokens
        const deletedTokens = await pool.query(
            'DELETE FROM blacklisted_tokens WHERE expires_at < NOW() RETURNING id'
        );
        console.log(`✅ Deleted ${deletedTokens.rowCount} expired blacklisted tokens`);

        // Delete expired sessions
        const deletedSessions = await pool.query(
            'DELETE FROM sessions WHERE expires_at < NOW() RETURNING id'
        );
        console.log(`✅ Deleted ${deletedSessions.rowCount} expired sessions`);

        // Delete old login history (older than 90 days)
        const deletedHistory = await pool.query(
            'DELETE FROM login_history WHERE login_time < NOW() - INTERVAL \'90 days\' RETURNING id'
        );
        console.log(`✅ Deleted ${deletedHistory.rowCount} old login history entries`);

        // Delete old notifications (older than 30 days and read)
        const deletedNotifications = await pool.query(
            'DELETE FROM notifications WHERE is_read = true AND read_at < NOW() - INTERVAL \'30 days\' RETURNING id'
        );
        console.log(`✅ Deleted ${deletedNotifications.rowCount} old notifications`);

        // Delete old activity logs (older than 30 days)
        const deletedActivity = await pool.query(
            'DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL \'30 days\' RETURNING id'
        );
        console.log(`✅ Deleted ${deletedActivity.rowCount} old activity logs`);

        // Delete completed tasks older than 90 days
        const deletedTasks = await pool.query(
            'DELETE FROM tasks WHERE status = \'done\' AND updated_at < NOW() - INTERVAL \'90 days\' RETURNING id'
        );
        console.log(`✅ Deleted ${deletedTasks.rowCount} old completed tasks`);

        // Unlock accounts that should be unlocked
        const unlockedAccounts = await pool.query(
            'UPDATE users SET locked_until = NULL WHERE locked_until < NOW() RETURNING id'
        );
        if (unlockedAccounts.rowCount > 0) {
            console.log(`✅ Unlocked ${unlockedAccounts.rowCount} accounts`);
        }

        console.log('✨ Cleanup completed successfully');

    } catch (error) {
        console.error('❌ Cleanup error:', error);
    }
};

// Function to get database stats
export const getDatabaseStats = async () => {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE role = 'admin') as admin_count,
                (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
                (SELECT COUNT(*) FROM users WHERE email_verified = true) as verified_users,
                (SELECT COUNT(*) FROM login_history WHERE login_time >= NOW() - INTERVAL '24 hours') as logins_24h,
                (SELECT COUNT(*) FROM sessions WHERE is_active = true) as active_sessions,
                (SELECT COUNT(*) FROM blacklisted_tokens WHERE expires_at > NOW()) as active_blacklisted_tokens,
                (SELECT COUNT(*) FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours') as audit_logs_24h,
                (SELECT COUNT(*) FROM notifications WHERE is_read = false) as unread_notifications,
                (SELECT COUNT(*) FROM attendance WHERE date = CURRENT_DATE) as today_attendance,
                (SELECT COUNT(*) FROM day_swaps WHERE status = 'pending') as pending_swaps,
                (SELECT COUNT(*) FROM activity_log WHERE created_at >= NOW() - INTERVAL '24 hours') as recent_activities,
                (SELECT COUNT(*) FROM tasks WHERE status != 'done') as active_tasks,
                (SELECT COUNT(*) FROM tasks WHERE status = 'todo') as todo_tasks,
                (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress') as in_progress_tasks,
                (SELECT COUNT(*) FROM tasks WHERE status = 'done' AND updated_at >= NOW() - INTERVAL '7 days') as completed_tasks_7d,
                (SELECT COUNT(*) FROM tasks WHERE due_date < CURRENT_DATE AND status != 'done') as overdue_tasks
        `);
        
        return stats.rows[0];
    } catch (error) {
        console.error('❌ Error getting database stats:', error);
        return null;
    }
};

// ✅ Auto-run when file is executed directly
const isDirectRun = process.argv[1].includes('initDB.js') || 
                   process.argv[1].includes('initDB');

if (isDirectRun) {
    console.log('🚀 Running database initialization script...');
    initializeDatabase()
        .then(async () => {
            const stats = await getDatabaseStats();
            console.log('\n📊 Database Statistics:');
            console.log(JSON.stringify(stats, null, 2));
            
            console.log('\n✨ Database is ready!');
            
            // Schedule cleanup every day
            setInterval(cleanupExpiredData, 24 * 60 * 60 * 1000);
            
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Database initialization failed:', error);
            process.exit(1);
        });
}

export default initializeDatabase;