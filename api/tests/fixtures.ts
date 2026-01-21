// Sample 1x1 pixel PNG as binary buffer
export const sampleImageBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Sample PDF-like binary buffer (minimal PDF structure for testing)
export const sampleFileBuffer = Buffer.from(
  'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVGl0bGUgKFRlc3QpCj4+CmVuZG9iagp0cmFpbGVyCjw8Ci9Sb290IDEgMCBSCj4+CiUlRU9G',
  'base64'
);

// Detection metadata fixture (without file)
export const detectionMetadata = {
  taskId: '304fd5a7bbb140e6865378daa7ecb78a',
  imageId: '9f45c112a4494b16a020abe14f8bf3ca',
  filename: 'test-image.jpg',
  width: 800,
  height: 600,
  annotations: [
    {
      id: 'test-annotation-1',
      type: 'rectanglelabels',
      value: {
        x: 10,
        y: 10,
        width: 50,
        height: 50,
        rectanglelabels: ['label1'],
      },
    },
  ],
};

// Text QA metadata fixture (without file)
export const textQaMetadata = {
  fileId: '2b3bb90bdea64a618626c4cf521c71e5',
  filename: 'test-document.pdf',
  taskId: '12345',
  batchId: 'cf91b6ee0e2942eb8dda22905fd7fd2b',
  annotations: {
    sections: [
      { id: 1, score: 'pass', reason: '' },
      { id: 2, score: 'fail', reason: 'formatting issue' },
    ],
  },
};

// Classify metadata fixture (without file)
export const classifyMetadata = {
  taskId: '61e2a285ba8f46bf9b3b2f7ddf890070',
  imageId: '2c234514cd8849ae95919c8289a623db',
  filename: 'classify-image.jpg',
  width: 1024,
  height: 768,
  labelIds: [1853, 1827],
};

/**
 * Helper to create FormData for multipart requests
 */
export function createFormData(
  metadata: object,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): FormData {
  const formData = new FormData();
  formData.append('metadata', JSON.stringify(metadata));
  formData.append('file', new Blob([fileBuffer], { type: mimeType }), filename);
  return formData;
}
