/**
 * Path Calculator
 * Utilities for calculating migration paths
 */

import type { CategoryInfo } from './types';

/**
 * Extract type from first path segment
 */
export function extractTypeFromPath(path: string): string {
  if (!path) return '';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const firstSlash = cleanPath.indexOf('/');
  return firstSlash === -1 ? cleanPath : cleanPath.slice(0, firstSlash);
}

/**
 * Extract YYYY-MM from path or use current month
 */
export function extractDateFromPath(path: string): string {
  // Match YYYY-MM-DD or YYYY-MM pattern
  const fullDateMatch = path.match(/(\d{4}-\d{2})-\d{2}/);
  if (fullDateMatch) {
    return fullDateMatch[1];
  }

  const monthMatch = path.match(/(\d{4}-\d{2})/);
  if (monthMatch) {
    return monthMatch[1];
  }

  // Return current month
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Calculate new path for a file
 * Standard format: {type}/{YYYY-MM}/{category1}/{category2}/{filename}
 */
export function calculateNewPath(
  oldPath: string,
  dateMonth: string,
  category: CategoryInfo
): string {
  const type = extractTypeFromPath(oldPath);
  const filename = oldPath.split('/').pop() || '';
  // Ensure both categories have values (use 未分类 as fallback)
  const cat1 = category.category1 || '未分类';
  const cat2 = category.category2 || '未分类';
  return `${type}/${dateMonth}/${cat1}/${cat2}/${filename}`;
}

/**
 * Check if file is already in correct location
 */
export function isCorrectLocation(currentPath: string, newPath: string): boolean {
  if (!currentPath || !newPath) return false;
  return currentPath === newPath;
}
