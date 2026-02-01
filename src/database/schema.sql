-- Team Certification Management System Database Schema
-- This schema implements the database design from the design document

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    requires_password_change BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Certifications table
CREATE TABLE IF NOT EXISTS certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('cloud', 'security', 'programming', 'database', 'network', 'project_management')),
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    description TEXT,
    validity_period INTEGER, -- months
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for certifications table
CREATE INDEX IF NOT EXISTS idx_certifications_category ON certifications(category);
CREATE INDEX IF NOT EXISTS idx_certifications_difficulty ON certifications(difficulty);
CREATE INDEX IF NOT EXISTS idx_certifications_issuer ON certifications(issuer);
CREATE INDEX IF NOT EXISTS idx_certifications_name ON certifications(name);

-- Study plans table
CREATE TABLE IF NOT EXISTS study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    start_date DATE NOT NULL,
    progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for study_plans table
CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_certification_id ON study_plans(certification_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_status ON study_plans(status);
CREATE INDEX IF NOT EXISTS idx_study_plans_target_date ON study_plans(target_date);
CREATE INDEX IF NOT EXISTS idx_study_plans_created_at ON study_plans(created_at);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
    achieved_date DATE NOT NULL,
    certification_number VARCHAR(255),
    expiry_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for achievements table
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_certification_id ON achievements(certification_id);
CREATE INDEX IF NOT EXISTS idx_achievements_achieved_date ON achievements(achieved_date);
CREATE INDEX IF NOT EXISTS idx_achievements_expiry_date ON achievements(expiry_date);
CREATE INDEX IF NOT EXISTS idx_achievements_is_active ON achievements(is_active);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL CHECK (type IN ('plan_reminder', 'expiry_warning', 'new_certification', 'achievement_report')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Audit log table for tracking all user operations (requirement 7.4)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Backup metadata table for tracking backup operations (requirement 7.1)
CREATE TABLE IF NOT EXISTS backup_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_name VARCHAR(255) NOT NULL,
    backup_path VARCHAR(500) NOT NULL,
    backup_size BIGINT,
    backup_type VARCHAR(50) NOT NULL CHECK (backup_type IN ('full', 'incremental')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for backup_metadata table
CREATE INDEX IF NOT EXISTS idx_backup_metadata_backup_name ON backup_metadata(backup_name);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_status ON backup_metadata(status);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_created_at ON backup_metadata(created_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_certifications_updated_at BEFORE UPDATE ON certifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_study_plans_updated_at BEFORE UPDATE ON study_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_achievements_updated_at BEFORE UPDATE ON achievements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries

-- View for active study plans with certification details
CREATE OR REPLACE VIEW active_study_plans_view AS
SELECT 
    sp.id,
    sp.user_id,
    u.name as user_name,
    u.email as user_email,
    sp.certification_id,
    c.name as certification_name,
    c.issuer,
    c.category,
    c.difficulty,
    sp.target_date,
    sp.start_date,
    sp.progress,
    sp.status,
    sp.created_at,
    sp.updated_at,
    CASE 
        WHEN sp.target_date < CURRENT_DATE THEN 'overdue'
        WHEN sp.target_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'due_soon'
        ELSE 'on_track'
    END as urgency_status
FROM study_plans sp
JOIN users u ON sp.user_id = u.id
JOIN certifications c ON sp.certification_id = c.id
WHERE sp.status IN ('planning', 'in_progress');

-- View for expiring certifications
CREATE OR REPLACE VIEW expiring_certifications_view AS
SELECT 
    a.id,
    a.user_id,
    u.name as user_name,
    u.email as user_email,
    a.certification_id,
    c.name as certification_name,
    c.issuer,
    a.achieved_date,
    a.expiry_date,
    a.certification_number,
    CASE 
        WHEN a.expiry_date < CURRENT_DATE THEN 'expired'
        WHEN a.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
        WHEN a.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'expiring_later'
        ELSE 'valid'
    END as expiry_status
FROM achievements a
JOIN users u ON a.user_id = u.id
JOIN certifications c ON a.certification_id = c.id
WHERE a.is_active = true AND a.expiry_date IS NOT NULL;

-- View for user statistics
CREATE OR REPLACE VIEW user_statistics_view AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    u.role,
    COALESCE(active_plans.count, 0) as active_plans_count,
    COALESCE(completed_plans.count, 0) as completed_plans_count,
    COALESCE(achievements.count, 0) as achievements_count,
    COALESCE(expiring_certs.count, 0) as expiring_certifications_count,
    CASE 
        WHEN COALESCE(active_plans.count, 0) + COALESCE(completed_plans.count, 0) = 0 THEN 0
        ELSE ROUND(
            (COALESCE(completed_plans.count, 0)::DECIMAL / 
             (COALESCE(active_plans.count, 0) + COALESCE(completed_plans.count, 0))) * 100, 2
        )
    END as completion_rate
FROM users u
LEFT JOIN (
    SELECT user_id, COUNT(*) as count 
    FROM study_plans 
    WHERE status IN ('planning', 'in_progress') 
    GROUP BY user_id
) active_plans ON u.id = active_plans.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as count 
    FROM study_plans 
    WHERE status = 'completed' 
    GROUP BY user_id
) completed_plans ON u.id = completed_plans.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as count 
    FROM achievements 
    WHERE is_active = true 
    GROUP BY user_id
) achievements ON u.id = achievements.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as count 
    FROM achievements 
    WHERE is_active = true 
    AND expiry_date IS NOT NULL 
    AND expiry_date <= CURRENT_DATE + INTERVAL '60 days'
    GROUP BY user_id
) expiring_certs ON u.id = expiring_certs.user_id;