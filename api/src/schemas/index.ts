import { z } from 'zod';

// 32-character hex ID pattern
const hexIdSchema = z.string().regex(
  /^[a-fA-F0-9]{32}$/,
  'Must be a 32-character hexadecimal string'
);

/**
 * Detection (目标检测) metadata schema (for multipart/form-data)
 * Supports both detection and multimodal annotation types
 */
export const detectionMetadataSchema = z.object({
  taskId: hexIdSchema,
  imageId: z.string().min(1),
  filename: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  annotations: z.array(z.unknown()), // Flexible annotation structure
  // Multimodal fields - backend determines type based on content
  descriptionAnnotation: z.array(z.unknown()).default([]),
  qaAnnotation: z.array(z.unknown()).default([]),
  // Upload metadata
  uploadTime: z.string().optional(),
  // Storage path for category extraction
  storagePath: z.string().optional()
});

export type DetectionMetadata = z.infer<typeof detectionMetadataSchema>;

/**
 * Text QA (文本质检) metadata schema (for multipart/form-data)
 */
export const textQaMetadataSchema = z.object({
  fileId: z.string().min(1),
  filename: z.string().min(1),
  taskId: z.union([z.string(), z.number()]), // Can be string or number
  batchId: z.string().min(1),
  annotations: z.unknown(), // Flexible annotation structure
  // Upload metadata
  uploadTime: z.string().optional(),
  // Storage path for category extraction
  storagePath: z.string().optional()
});

export type TextQaMetadata = z.infer<typeof textQaMetadataSchema>;

/**
 * Classify (图像分类) metadata schema (for multipart/form-data)
 */
export const classifyMetadataSchema = z.object({
  taskId: hexIdSchema,
  imageId: z.string().min(1),
  filename: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  labelIds: z.array(z.number()),
  // Upload metadata
  uploadTime: z.string().optional(),
  // Storage path for category extraction
  storagePath: z.string().optional()
});

export type ClassifyMetadata = z.infer<typeof classifyMetadataSchema>;

/**
 * QA Pair (问答对标注) metadata schema
 */
export const qaPairMetadataSchema = z.object({
  taskId: z.string().min(1),
  dataTxtId: z.string().optional(),
  filename: z.string().min(1),
  department: z.string().optional(),
  annotation: z.object({
    dataId: z.number(),
    isAvailable: z.string().optional(),
    questionType: z.string().optional(),
    applicableRole: z.string().optional(),
    applicableScene: z.string().optional(),
    editedInput: z.string().optional(),
    editedAnswer: z.string().optional()
  }),
  uploadTime: z.string().optional(),
  storagePath: z.string().optional()
});

export type QaPairMetadata = z.infer<typeof qaPairMetadataSchema>;
