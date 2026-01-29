/**
 * Migration Types
 * Type definitions for MinIO storage migration utilities
 */

/**
 * Object entry from MinIO listing (obj.json)
 */
export interface ObjectEntry {
  key: string;
  originalKey?: string; // Original key if different (for URL-encoded paths)
  size?: number;
  lastModified?: string;
  etag?: string;
}

/**
 * Paired image and metadata JSON files
 */
export interface FilePair {
  imagePath: string;
  jsonPath: string;
  originalImagePath?: string; // Original key if URL-encoded
  originalJsonPath?: string; // Original key if URL-encoded
  labels?: string[];
}

/**
 * Result of processing a single file pair
 */
export interface MigrationResult {
  success: boolean;
  oldImagePath: string;
  oldJsonPath: string;
  newImagePath?: string;
  newJsonPath?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Migration statistics
 */
export interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  reclassified: number;
  startTime: Date;
  endTime?: Date;
}

/**
 * CLI options for migration script
 */
export interface MigrationOptions {
  dryRun: boolean;
  verbose: boolean;
  objListPath: string;
  classesPath: string;
  reclassify: boolean;
  listUncategorized: boolean;
  scanAll: boolean;
  listNonCompliant: boolean;
}

/**
 * Metadata JSON structure (from label annotations)
 */
export interface MetadataJson {
  labels?: string[];
  labelIds?: number[];
  annotations?: AnnotationEntry[];
  [key: string]: unknown;
}

/**
 * Annotation entry structure
 */
export interface AnnotationEntry {
  type?: string;
  value?: {
    rectanglelabels?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Category information
 */
export interface CategoryInfo {
  category1: string;
  category2: string;
}

/**
 * Default uncategorized category path
 */
export const UNCATEGORIZED_CATEGORY: CategoryInfo = {
  category1: '未分类',
  category2: '未分类',
};

/**
 * Uncategorized path pattern
 */
export const UNCATEGORIZED_PATH_PATTERN = '未分类/未分类';
