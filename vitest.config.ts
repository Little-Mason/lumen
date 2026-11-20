import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Windows 上多个 worker 并发写 Vite 的 %TEMP%/ssr 缓存会触发 EPERM，
    // 导致某个测试文件被静默跳过。单 worker 对这几个纯函数用例没有性能代价。
    minWorkers: 1,
    maxWorkers: 1,
    coverage: { reporter: ['text', 'html'] },
  },
});
