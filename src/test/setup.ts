import * as fs from 'fs/promises';
import * as path from 'path';

// テスト用のデータディレクトリ
const TEST_DATA_DIRS = ['./test-data', './test-data-auth', './test-data-cert', './test-data-storage', './test-data-study-plan', './test-data-achievement', './test-data-notification'];

// テスト前にテスト用データディレクトリをクリーンアップ
beforeEach(async () => {
  for (const dir of TEST_DATA_DIRS) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // ディレクトリが存在しない場合は無視
    }
  }
  
  // 少し待機してファイルシステムの操作が完了するのを待つ
  await new Promise(resolve => setTimeout(resolve, 100));
});

// テスト後にテスト用データディレクトリをクリーンアップ
afterEach(async () => {
  // 少し待機してテストが完了するのを待つ
  await new Promise(resolve => setTimeout(resolve, 100));
  
  for (const dir of TEST_DATA_DIRS) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // ディレクトリが存在しない場合は無視
    }
  }
});

// グローバルなテスト設定
global.console = {
  ...console,
  // テスト中のログ出力を抑制
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};