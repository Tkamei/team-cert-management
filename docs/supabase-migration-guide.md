# Supabase移行ガイド

## 1. Supabaseプロジェクト設定

### プロジェクト作成
1. [Supabase](https://supabase.com) でアカウント作成
2. 新しいプロジェクト作成
3. データベースパスワード設定

### データベーススキーマ作成
```sql
-- ユーザーテーブル
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entra_id TEXT UNIQUE, -- Entra IDとの連携用
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 資格テーブル
CREATE TABLE certifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  description TEXT,
  validity_period INTEGER, -- 有効期限（月数）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 学習計画テーブル
CREATE TABLE study_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  certification_id UUID REFERENCES certifications(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  target_date DATE NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 取得履歴テーブル
CREATE TABLE achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  certification_id UUID REFERENCES certifications(id) ON DELETE CASCADE,
  achieved_date DATE NOT NULL,
  expiry_date DATE,
  certification_number TEXT,
  score INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 通知テーブル
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX idx_achievements_user_id ON achievements(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_achievements_expiry_date ON achievements(expiry_date) WHERE expiry_date IS NOT NULL;
```

### Row Level Security (RLS) 設定
```sql
-- RLS有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ユーザーポリシー
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- 学習計画ポリシー
CREATE POLICY "Users can manage own study plans" ON study_plans
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Admins can view all study plans" ON study_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- 取得履歴ポリシー
CREATE POLICY "Users can manage own achievements" ON achievements
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Admins can view all achievements" ON achievements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- 通知ポリシー
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id::text = auth.uid()::text);

-- 資格は全員が閲覧可能
CREATE POLICY "Anyone can view certifications" ON certifications
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage certifications" ON certifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );
```

## 2. データ移行スクリプト

### 既存JSONデータの移行
```typescript
// scripts/migrate-to-supabase.ts
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Service Key使用（RLSバイパス）
);

async function migrateData() {
  console.log('Starting data migration...');

  // 1. 資格データ移行
  const certifications = JSON.parse(fs.readFileSync('data/certifications.json', 'utf8'));
  for (const cert of certifications.certifications) {
    const { error } = await supabase
      .from('certifications')
      .insert({
        id: cert.id,
        name: cert.name,
        issuer: cert.issuer,
        category: cert.category,
        difficulty: cert.difficulty,
        description: cert.description,
        validity_period: cert.validityPeriod
      });
    
    if (error) console.error('Certification migration error:', error);
  }

  // 2. ユーザーデータ移行
  const users = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
  for (const user of users.users) {
    const { error } = await supabase
      .from('users')
      .insert({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      });
    
    if (error) console.error('User migration error:', error);
  }

  // 3. 学習計画移行
  const studyPlans = JSON.parse(fs.readFileSync('data/study_plans.json', 'utf8'));
  for (const plan of studyPlans.studyPlans) {
    const { error } = await supabase
      .from('study_plans')
      .insert({
        id: plan.id,
        user_id: plan.userId,
        certification_id: plan.certificationId,
        start_date: plan.startDate,
        target_date: plan.targetDate,
        progress: plan.progress,
        status: plan.status,
        notes: plan.notes
      });
    
    if (error) console.error('Study plan migration error:', error);
  }

  // 4. 取得履歴移行
  const achievements = JSON.parse(fs.readFileSync('data/achievements.json', 'utf8'));
  for (const achievement of achievements.achievements) {
    const { error } = await supabase
      .from('achievements')
      .insert({
        id: achievement.id,
        user_id: achievement.userId,
        certification_id: achievement.certificationId,
        achieved_date: achievement.achievedDate,
        expiry_date: achievement.expiryDate,
        certification_number: achievement.certificationNumber,
        score: achievement.score,
        is_active: achievement.isActive
      });
    
    if (error) console.error('Achievement migration error:', error);
  }

  console.log('Migration completed!');
}

migrateData().catch(console.error);
```

## 3. フロントエンド改修

### Supabaseクライアント設定
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 型定義
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          entra_id: string | null;
          name: string;
          email: string;
          role: 'admin' | 'member';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entra_id?: string | null;
          name: string;
          email: string;
          role?: 'admin' | 'member';
        };
        Update: {
          name?: string;
          email?: string;
          role?: 'admin' | 'member';
        };
      };
      // 他のテーブル定義...
    };
  };
}
```

### 認証の実装
```typescript
// lib/auth.ts
import { supabase } from './supabase';

export const signInWithAzure = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email profile',
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
  
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};
```

### APIクライアントの改修
```typescript
// lib/api.ts
import { supabase } from './supabase';

export class SupabaseAPI {
  // 学習計画取得
  async getStudyPlans(userId?: string) {
    let query = supabase
      .from('study_plans')
      .select(`
        *,
        certifications (name, issuer),
        users (name, email)
      `);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    return { data, error };
  }

  // 学習計画作成
  async createStudyPlan(planData: any) {
    const { data, error } = await supabase
      .from('study_plans')
      .insert(planData)
      .select()
      .single();
    
    return { data, error };
  }

  // 学習計画更新
  async updateStudyPlan(id: string, updates: any) {
    const { data, error } = await supabase
      .from('study_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    return { data, error };
  }

  // 取得履歴取得
  async getAchievements(userId?: string) {
    let query = supabase
      .from('achievements')
      .select(`
        *,
        certifications (name, issuer),
        users (name, email)
      `);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    return { data, error };
  }
}

export const api = new SupabaseAPI();
```

## 4. GitHub Pages設定

### Next.js設定（静的エクスポート）
```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
};

module.exports = nextConfig;
```

### GitHub Actions設定
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
      env:
        NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
    
    - name: Setup Pages
      uses: actions/configure-pages@v4
    
    - name: Upload artifact
      uses: actions/upload-pages-artifact@v3
      with:
        path: './out'
    
    - name: Deploy to GitHub Pages
      id: deployment
      uses: actions/deploy-pages@v4
```

## 5. Entra ID統合

### Supabase Auth設定
1. Supabase Dashboard > Authentication > Providers
2. Azure を有効化
3. Azure App Registration で以下を設定：
   - Redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Client ID と Client Secret を Supabase に設定

### フロントエンドでの認証フロー
```typescript
// pages/login.tsx
import { signInWithAzure } from '../lib/auth';

export default function Login() {
  const handleLogin = async () => {
    const { error } = await signInWithAzure();
    if (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div>
      <button onClick={handleLogin}>
        Entra ID でログイン
      </button>
    </div>
  );
}
```

この構成により、**完全無料**で高機能なチーム資格管理システムが運用できます！