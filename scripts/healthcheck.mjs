/**
 * Docker HEALTHCHECK 探针：只认 /api/health 的 200（数据库真的连得上）。
 * 降级响应 503 会让容器进入 unhealthy，从而触发 compose / 编排层的重启或回滚。
 */
import { get } from 'node:http';

const port = Number(process.env.PORT || 3000);
const request = get({ host: '127.0.0.1', port, path: '/api/health', timeout: 4000 }, (response) => {
  response.resume();
  process.exit(response.statusCode === 200 ? 0 : 1);
});

request.on('timeout', () => request.destroy(new Error('healthcheck timeout')));
request.on('error', () => process.exit(1));
