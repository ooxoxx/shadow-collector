/**
 * Path Validator
 * Validates storage paths against the standard format:
 * {type}/{YYYY-MM}/{category1}/{category2}/{filename}
 */

/**
 * Valid storage types
 */
export const STORAGE_TYPES = [
  'detection',
  'multimodal',
  'text-qa',
  'classify',
  'qa-pair',
] as const;

export type StorageType = (typeof STORAGE_TYPES)[number];

/**
 * Path violation types
 */
export type PathViolationType = 'valid' | 'old-taskid' | 'old-flat' | 'unknown';

/**
 * Parsed path information
 */
export interface ParsedPath {
  type: string;
  date: string;
  category1?: string;
  category2?: string;
  taskId?: string;
  filename: string;
}

// Regex patterns
const VALID_PATH_REGEX =
  /^(detection|multimodal|text-qa|classify|qa-pair)\/\d{4}-\d{2}\/[^\/]+\/[^\/]+\/[^\/]+$/;

// Old taskId format: {type}/{YYYY-MM-DD}/{32-char-hex}/{filename}
const OLD_TASKID_REGEX =
  /^(detection|multimodal|text-qa|classify|qa-pair)\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{32}\/[^\/]+$/;

// Old flat format: {type}/{YYYY-MM-DD}/{filename.ext}
const OLD_FLAT_REGEX =
  /^(detection|multimodal|text-qa|classify|qa-pair)\/\d{4}-\d{2}-\d{2}\/[^\/]+\.(jpg|jpeg|png|gif|webp|bmp|json)$/i;

/**
 * Check if a path matches the standard storage format
 * Format: {type}/{YYYY-MM}/{category1}/{category2}/{filename}
 */
export function isValidStoragePath(path: string): boolean {
  if (!path) return false;
  return VALID_PATH_REGEX.test(path);
}

/**
 * Determine the type of path violation
 */
export function getPathViolationType(path: string): PathViolationType {
  if (!path) return 'unknown';

  // Check valid first
  if (VALID_PATH_REGEX.test(path)) {
    return 'valid';
  }

  // Check old taskId format
  if (OLD_TASKID_REGEX.test(path)) {
    return 'old-taskid';
  }

  // Check old flat format
  if (OLD_FLAT_REGEX.test(path)) {
    return 'old-flat';
  }

  return 'unknown';
}

/**
 * Parse a path into its components
 */
export function parseExistingPath(path: string): ParsedPath {
  if (!path) {
    return {
      type: '',
      date: '',
      filename: '',
    };
  }

  const segments = path.split('/');
  const type = segments[0] || '';
  const date = segments[1] || '';
  const filename = segments[segments.length - 1] || '';

  // 5 segments: valid format {type}/{date}/{cat1}/{cat2}/{filename}
  if (segments.length === 5) {
    return {
      type,
      date,
      category1: segments[2],
      category2: segments[3],
      filename,
    };
  }

  // 4 segments: old taskId format {type}/{date}/{taskId}/{filename}
  if (segments.length === 4) {
    const possibleTaskId = segments[2];
    // Check if it looks like a 32-char hex taskId
    if (/^[a-f0-9]{32}$/.test(possibleTaskId)) {
      return {
        type,
        date,
        taskId: possibleTaskId,
        category1: undefined,
        category2: undefined,
        filename,
      };
    }
    return {
      type,
      date,
      category1: undefined,
      category2: undefined,
      filename,
    };
  }

  // 3 segments: old flat format {type}/{date}/{filename}
  if (segments.length === 3) {
    return {
      type,
      date,
      category1: undefined,
      category2: undefined,
      filename,
    };
  }

  // Other formats
  return {
    type,
    date,
    filename,
  };
}
