import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(import.meta.dir, '../../logs');

// 确保日志目录存在
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

function getDateStr(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getTimestamp(): string {
  return new Date().toISOString();
}

// 上传成功日志
export function logUpload(workflowType: string, details: Record<string, unknown>): void {
  const logFile = join(LOG_DIR, `upload-${getDateStr()}.log`);
  const detailsStr = Object.entries(details)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
  const line = `[${getTimestamp()}] [${workflowType}] ${detailsStr}\n`;
  appendFileSync(logFile, line);
}

// 错误日志
export function logError(workflowType: string, message: string, details?: unknown): void {
  const logFile = join(LOG_DIR, `error-${getDateStr()}.log`);
  const detailsStr = details ? ` details=${JSON.stringify(details)}` : '';
  const line = `[${getTimestamp()}] [ERROR] [${workflowType}] message="${message}"${detailsStr}\n`;
  appendFileSync(logFile, line);
}
