# GitHub Pages移行 クイックスタートチェックリスト

## ✅ 事前準備（5分）

- [ ] GitHubアカウントの確認
- [ ] 現在のプロジェクトファイルの確認
- [ ] 作業時間の確保（1-2時間）

## ✅ Step 1: リポジトリ作成（5分）

- [ ] GitHub.com にログイン
- [ ] 新しいリポジトリ作成: `team-cert-management`
- [ ] Public に設定
- [ ] 既存コードをプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/team-cert-management.git
git push -u origin main
```

## ✅ Step 2: GitHub Pages 設定（3分）

- [ ] リポジトリ Settings > Pages
- [ ] Source: "Deploy from a branch"
- [ ] Branch: "main", Folder: "/docs"
- [ ] Save をクリック

## ✅ Step 3: Personal Access Token 作成（3分）

- [ ] GitHub Settings > Developer settings > Personal access tokens
- [ ] "Generate new token (classic)"
- [ ] Note: "Team Cert Management"
- [ ] Scopes: `repo` にチェック
- [ ] トークンをコピー・保存

## ✅ Step 4: 設定ファイル更新（5分）

### api/github-storage.js を編集:
```javascript
constructor() {
    this.owner = 'YOUR_GITHUB_USERNAME'; // ← あなたのユーザー名
    this.repo = 'team-cert-management';
    // ...
}
```

### docs/index.html のスクリプトパス確認:
```html
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/team-cert-management@main/api/github-storage.js"></script>
```

## ✅ Step 5: ユーザーデータ設定（10分）

### data/users.json を編集:
```json
{
  "users": [
    {
      "id": "admin-user",
      "name": "あなたの名前",
      "email": "your-email@domain.com",
      "role": "admin",
      "githubUsername": "your-github-username",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "member-1",
      "name": "メンバー1",
      "email": "member1@domain.com", 
      "role": "member",
      "githubUsername": "member1-github-username",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## ✅ Step 6: デプロイ（2分）

```bash
git add .
git commit -m "Setup GitHub Pages with JSON storage"
git push origin main
```

## ✅ Step 7: 動作確認（10分）

- [ ] `https://YOUR_USERNAME.github.io/team-cert-management/` にアクセス
- [ ] ログイン画面が表示される
- [ ] "GitHubでログイン" をクリック
- [ ] Personal Access Token を入力
- [ ] ダッシュボードが表示される
- [ ] 各ページの動作確認

## ✅ Step 8: チームメンバー招待（5分）

### リポジトリへの招待:
- [ ] リポジトリ Settings > Manage access
- [ ] "Invite a collaborator"
- [ ] メンバーのGitHubユーザー名を入力
- [ ] "Write" 権限で招待

### メンバーへの案内:
- [ ] アクセスURL を共有: `https://YOUR_USERNAME.github.io/team-cert-management/`
- [ ] Personal Access Token 作成手順を共有
- [ ] 初回ログイン方法を説明

## ✅ Step 9: 最終確認（5分）

- [ ] 全メンバーがアクセス可能
- [ ] データ表示が正常
- [ ] データ更新が可能（テスト）
- [ ] GitHub リポジトリにコミットが記録される

## 🎉 完了！

**総作業時間: 約1時間**
**月額コスト: ¥0**

## 📝 メモ欄

### Personal Access Token:
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### アクセスURL:
```
https://YOUR_USERNAME.github.io/team-cert-management/
```

### チームメンバー:
- [ ] メンバー1: @github-username1
- [ ] メンバー2: @github-username2  
- [ ] メンバー3: @github-username3
- [ ] メンバー4: @github-username4
- [ ] メンバー5: @github-username5

## 🚨 トラブルシューティング

### ログインできない場合:
1. Personal Access Token の `repo` スコープ確認
2. トークンの有効期限確認
3. GitHubユーザー名とリポジトリ名の確認

### ページが表示されない場合:
1. GitHub Pages 設定確認（/docs フォルダ）
2. 数分待ってから再アクセス
3. ブラウザキャッシュクリア

### データが更新されない場合:
1. リポジトリの Write 権限確認
2. GitHub API レート制限確認
3. ブラウザの開発者ツールでエラー確認

## 📞 サポート

問題が解決しない場合は、GitHub Issues で質問してください:
https://github.com/YOUR_USERNAME/team-cert-management/issues