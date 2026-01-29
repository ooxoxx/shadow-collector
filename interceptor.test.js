// interceptor.test.js
import { describe, it, expect } from 'bun:test';

// 从 interceptor.js 提取的辅助函数（用于测试）
function encodePathSegments(path) {
  if (!path) return '';
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

describe('encodePathSegments', () => {
  it('应正确编码中文路径', () => {
    const input = '原始样本区/天津/file.jpg';
    const expected = '%E5%8E%9F%E5%A7%8B%E6%A0%B7%E6%9C%AC%E5%8C%BA/%E5%A4%A9%E6%B4%A5/file.jpg';
    expect(encodePathSegments(input)).toBe(expected);
  });

  it('应保留 / 分隔符', () => {
    const input = 'a/b/c';
    expect(encodePathSegments(input)).toBe('a/b/c');
  });

  it('应处理空路径', () => {
    expect(encodePathSegments('')).toBe('');
    expect(encodePathSegments(null)).toBe('');
    expect(encodePathSegments(undefined)).toBe('');
  });

  it('应编码特殊字符', () => {
    const input = 'path/file name.jpg';
    expect(encodePathSegments(input)).toBe('path/file%20name.jpg');
  });

  it('应编码多层中文路径', () => {
    const input = '数据/2024-01/北京/测试文件.txt';
    const expected = '%E6%95%B0%E6%8D%AE/2024-01/%E5%8C%97%E4%BA%AC/%E6%B5%8B%E8%AF%95%E6%96%87%E4%BB%B6.txt';
    expect(encodePathSegments(input)).toBe(expected);
  });

  it('应正确处理带 auth 参数的路径', () => {
    // 注意：auth 参数中的 = 和其他特殊字符也会被编码
    const input = 'storage/file.jpg?auth=token123';
    // ? 和 = 会被编码
    expect(encodePathSegments(input)).toBe('storage/file.jpg%3Fauth%3Dtoken123');
  });

  it('应处理纯 ASCII 路径不变', () => {
    const input = 'images/2024/photo.jpg';
    expect(encodePathSegments(input)).toBe('images/2024/photo.jpg');
  });

  it('应编码 # 和 & 等 URL 敏感字符', () => {
    const input = 'path/file#1&2.jpg';
    expect(encodePathSegments(input)).toBe('path/file%231%262.jpg');
  });
});
