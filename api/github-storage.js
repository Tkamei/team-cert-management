// GitHub API を使ったJSONファイル操作クラス
class GitHubStorage {
  constructor() {
    this.owner = 'YOUR_GITHUB_USERNAME'; // 実際のGitHubユーザー名に変更してください
    this.repo = 'team-cert-management';   // リポジトリ名
    this.clientId = 'YOUR_OAUTH_CLIENT_ID'; // GitHub OAuth App のClient IDに変更してください
    this.token = null;
    this.branch = 'main';
  }

  // GitHub認証
  async authenticate() {
    const token = localStorage.getItem('github_token');
    if (!token) {
      throw new Error('GitHub token not found. Please login first.');
    }
    this.token = token;
    
    // トークンの有効性確認
    try {
      await this.getCurrentUser();
    } catch (error) {
      localStorage.removeItem('github_token');
      throw new Error('Invalid token. Please login again.');
    }
  }

  // GitHub OAuth ログイン（簡易版）
  async loginWithGitHub() {
    // Personal Access Token を使用する簡易版
    const token = prompt('GitHub Personal Access Token を入力してください:\n\n1. GitHub Settings > Developer settings > Personal access tokens\n2. Generate new token (classic)\n3. repo スコープを選択\n4. 生成されたトークンを入力');
    
    if (!token) {
      throw new Error('Token is required');
    }
    
    // トークンの有効性確認
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Invalid token');
      }
      
      localStorage.setItem('github_token', token);
      this.token = token;
      
      return token;
    } catch (error) {
      throw new Error('Invalid token. Please check your Personal Access Token.');
    }
  }

  // ファイル内容取得
  async getFile(path) {
    try {
      const response = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // ファイルが存在しない場合は空のデータを返す
          return this.getEmptyData(path);
        }
        throw new Error(`Failed to get file: ${response.statusText}`);
      }

      const data = await response.json();
      const content = JSON.parse(atob(data.content));
      
      return {
        content,
        sha: data.sha
      };
    } catch (error) {
      console.error('Error getting file:', error);
      throw error;
    }
  }

  // 空のデータ構造を返す
  getEmptyData(path) {
    const emptyStructures = {
      'data/users.json': { users: [] },
      'data/certifications.json': { certifications: [] },
      'data/study_plans.json': { studyPlans: [] },
      'data/achievements.json': { achievements: [] },
      'data/notifications.json': { notifications: [] }
    };
    
    return {
      content: emptyStructures[path] || {},
      sha: null
    };
  }

  // ファイル更新
  async updateFile(path, content, message = 'Update data') {
    try {
      const currentFile = await this.getFile(path);
      
      const body = {
        message,
        content: btoa(JSON.stringify(content, null, 2)),
        branch: this.branch
      };
      
      if (currentFile.sha) {
        body.sha = currentFile.sha;
      }
      
      const response = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Failed to update file: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating file:', error);
      throw error;
    }
  }

  // ユーザー一覧取得
  async getUsers() {
    const file = await this.getFile('data/users.json');
    return file.content;
  }

  // 資格一覧取得
  async getCertifications() {
    const file = await this.getFile('data/certifications.json');
    return file.content;
  }

  // 学習計画一覧取得
  async getStudyPlans() {
    const file = await this.getFile('data/study_plans.json');
    return file.content;
  }

  // 学習計画更新
  async updateStudyPlan(planId, updates) {
    const studyPlans = await this.getStudyPlans();
    const planIndex = studyPlans.studyPlans.findIndex(p => p.id === planId);
    
    if (planIndex === -1) {
      throw new Error('Study plan not found');
    }
    
    studyPlans.studyPlans[planIndex] = {
      ...studyPlans.studyPlans[planIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.updateFile('data/study_plans.json', studyPlans, `Update study plan: ${planId}`);
    return studyPlans.studyPlans[planIndex];
  }

  // 個別学習計画取得
  async getStudyPlan(planId) {
    const studyPlans = await this.getStudyPlans();
    const plan = studyPlans.studyPlans.find(p => p.id === planId);
    
    if (!plan) {
      throw new Error('Study plan not found');
    }
    
    return plan;
  }

  // 取得履歴一覧取得
  async getAchievements() {
    const file = await this.getFile('data/achievements.json');
    return file.content;
  }

  // 取得履歴更新
  async updateAchievement(achievementId, updates) {
    const achievements = await this.getAchievements();
    const achievementIndex = achievements.achievements.findIndex(a => a.id === achievementId);
    
    if (achievementIndex === -1) {
      throw new Error('Achievement not found');
    }
    
    achievements.achievements[achievementIndex] = {
      ...achievements.achievements[achievementIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.updateFile('data/achievements.json', achievements, `Update achievement: ${achievementId}`);
    return achievements.achievements[achievementIndex];
  }

  // 個別取得履歴取得
  async getAchievement(achievementId) {
    const achievements = await this.getAchievements();
    const achievement = achievements.achievements.find(a => a.id === achievementId);
    
    if (!achievement) {
      throw new Error('Achievement not found');
    }
    
    return achievement;
  }

  // 通知一覧取得
  async getNotifications() {
    const file = await this.getFile('data/notifications.json');
    return file.content;
  }

  // 現在のユーザー情報取得
  async getCurrentUser() {
    if (!this.token) {
      return null;
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      const githubUser = await response.json();
      
      // アプリケーションのユーザー情報と照合
      const users = await this.getUsers();
      const appUser = users.users.find(u => 
        u.email === githubUser.email || 
        u.githubUsername === githubUser.login
      );
      
      return {
        github: githubUser,
        app: appUser
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }

  // ログアウト
  logout() {
    localStorage.removeItem('github_token');
    this.token = null;
    window.location.reload();
  }

  // ID生成
  generateId() {
    return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
  }
}

// グローバルインスタンス
window.GitHubStorage = GitHubStorage;