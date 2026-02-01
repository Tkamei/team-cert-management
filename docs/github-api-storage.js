// GitHub API を使ったJSONファイル操作クラス
class GitHubStorage {
  constructor() {
    this.owner = 'your-github-username'; // GitHubユーザー名
    this.repo = 'team-cert-management';   // リポジトリ名
    this.token = null; // GitHub Personal Access Token
    this.branch = 'main';
  }

  // GitHub認証
  async authenticate() {
    // GitHub OAuth または Personal Access Token
    const token = localStorage.getItem('github_token');
    if (!token) {
      await this.loginWithGitHub();
    } else {
      this.token = token;
    }
  }

  // GitHub OAuth ログイン
  async loginWithGitHub() {
    const clientId = 'your-github-oauth-client-id';
    const redirectUri = window.location.origin;
    const scope = 'repo';
    
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
    
    // 新しいウィンドウでGitHub認証
    const authWindow = window.open(authUrl, 'github-auth', 'width=600,height=600');
    
    return new Promise((resolve, reject) => {
      const checkClosed = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkClosed);
          const token = localStorage.getItem('github_token');
          if (token) {
            this.token = token;
            resolve(token);
          } else {
            reject(new Error('Authentication failed'));
          }
        }
      }, 1000);
    });
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

  // ファイル更新
  async updateFile(path, content, message = 'Update data') {
    try {
      // 現在のファイル情報を取得（SHA値が必要）
      const currentFile = await this.getFile(path);
      
      const response = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          content: btoa(JSON.stringify(content, null, 2)),
          sha: currentFile.sha,
          branch: this.branch
        })
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

  // ユーザー追加
  async addUser(user) {
    const users = await this.getUsers();
    users.users.push({
      ...user,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    await this.updateFile('data/users.json', users, `Add user: ${user.name}`);
    return users;
  }

  // ユーザー更新
  async updateUser(userId, updates) {
    const users = await this.getUsers();
    const userIndex = users.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    
    users.users[userIndex] = {
      ...users.users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.updateFile('data/users.json', users, `Update user: ${userId}`);
    return users.users[userIndex];
  }

  // 資格一覧取得
  async getCertifications() {
    const file = await this.getFile('data/certifications.json');
    return file.content;
  }

  // 資格追加
  async addCertification(certification) {
    const certifications = await this.getCertifications();
    certifications.certifications.push({
      ...certification,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    await this.updateFile('data/certifications.json', certifications, `Add certification: ${certification.name}`);
    return certifications;
  }

  // 学習計画一覧取得
  async getStudyPlans() {
    const file = await this.getFile('data/study_plans.json');
    return file.content;
  }

  // 学習計画追加
  async addStudyPlan(plan) {
    const studyPlans = await this.getStudyPlans();
    studyPlans.studyPlans.push({
      ...plan,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    await this.updateFile('data/study_plans.json', studyPlans, `Add study plan: ${plan.certificationId}`);
    return studyPlans;
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

  // 取得履歴一覧取得
  async getAchievements() {
    const file = await this.getFile('data/achievements.json');
    return file.content;
  }

  // 取得履歴追加
  async addAchievement(achievement) {
    const achievements = await this.getAchievements();
    achievements.achievements.push({
      ...achievement,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    await this.updateFile('data/achievements.json', achievements, `Add achievement: ${achievement.certificationId}`);
    return achievements;
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

  // 通知一覧取得
  async getNotifications() {
    const file = await this.getFile('data/notifications.json');
    return file.content;
  }

  // 通知追加
  async addNotification(notification) {
    const notifications = await this.getNotifications();
    notifications.notifications.push({
      ...notification,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    });
    
    await this.updateFile('data/notifications.json', notifications, `Add notification`);
    return notifications;
  }

  // ID生成
  generateId() {
    return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
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
      const appUser = users.users.find(u => u.email === githubUser.email);
      
      return {
        github: githubUser,
        app: appUser
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // ログアウト
  logout() {
    localStorage.removeItem('github_token');
    this.token = null;
    window.location.reload();
  }
}

// グローバルインスタンス
const githubStorage = new GitHubStorage();

// 使用例
/*
// 初期化
await githubStorage.authenticate();

// データ取得
const users = await githubStorage.getUsers();
const certifications = await githubStorage.getCertifications();

// データ更新
await githubStorage.addUser({
  name: '田中太郎',
  email: 'tanaka@example.com',
  role: 'member'
});

await githubStorage.updateStudyPlan('plan-id', {
  progress: 75,
  notes: '進捗更新'
});
*/