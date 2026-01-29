# Shadow Collector API

Bun API service that receives label data from the Chrome extension and stores it to MinIO.

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Copy environment file and configure:
   ```bash
   cp .env.example .env
   ```

3. Start MinIO (using Docker):
   ```bash
   docker run -d \
     -p 9000:9000 \
     -p 9001:9001 \
     -e MINIO_ROOT_USER=minioadmin \
     -e MINIO_ROOT_PASSWORD=minioadmin \
     minio/minio server /data --console-address ":9001"
   ```

4. Create the bucket via MinIO Console at http://127.0.0.1:9001:
   - Login with minioadmin/minioadmin
   - Create bucket named `shadow-collector`

5. Run the API:
   ```bash
   bun run dev
   ```

## API Endpoints

| Endpoint | Method | Content-Type | Description |
|----------|--------|--------------|-------------|
| `GET /health` | GET | - | Health check |
| `POST /api/v1/label/detection` | POST | multipart/form-data | Store detection annotations |
| `POST /api/v1/label/text-qa` | POST | multipart/form-data | Store text QA annotations |
| `POST /api/v1/label/classify` | POST | multipart/form-data | Store classification labels |

## Request Format (Multipart/Form-Data)

All label endpoints use `multipart/form-data` with two fields:

- `metadata` - JSON string containing structured metadata
- `file` - Binary file data

### Detection

```bash
curl -X POST http://127.0.0.1:8001/api/v1/label/detection \
  -F 'metadata={"taskId":"304fd5a7bbb140e6865378daa7ecb78a","imageId":"9f45c112a4494b16a020abe14f8bf3ca","filename":"image001.jpg","width":2592,"height":1944,"annotations":[]}' \
  -F 'file=@/path/to/image.jpg'
```

**Metadata fields:**
| Field | Type | Description |
|-------|------|-------------|
| taskId | string | 32-char hex ID |
| imageId | string | Image identifier |
| filename | string | Original filename |
| width | number | Image width in pixels |
| height | number | Image height in pixels |
| annotations | array | Annotation data |

### Text QA

```bash
curl -X POST http://127.0.0.1:8001/api/v1/label/text-qa \
  -F 'metadata={"fileId":"2b3bb90bdea64a618626c4cf521c71e5","filename":"document.pdf","taskId":"12345","batchId":"cf91b6ee0e2942eb8dda22905fd7fd2b","annotations":{}}' \
  -F 'file=@/path/to/document.pdf'
```

**Metadata fields:**
| Field | Type | Description |
|-------|------|-------------|
| fileId | string | File identifier |
| filename | string | Original filename |
| taskId | string \| number | Task identifier |
| batchId | string | Batch identifier |
| annotations | any | QA annotation data |

### Classify

```bash
curl -X POST http://127.0.0.1:8001/api/v1/label/classify \
  -F 'metadata={"taskId":"61e2a285ba8f46bf9b3b2f7ddf890070","imageId":"2c234514cd8849ae95919c8289a623db","filename":"image001.jpg","width":800,"height":600,"labelIds":[1853,1827]}' \
  -F 'file=@/path/to/image.jpg'
```

**Metadata fields:**
| Field | Type | Description |
|-------|------|-------------|
| taskId | string | 32-char hex ID |
| imageId | string | Image identifier |
| filename | string | Original filename |
| width | number | Image width in pixels |
| height | number | Image height in pixels |
| labelIds | number[] | Array of label IDs |

## Testing

Run e2e tests:
```bash
bun test
```

Test the health endpoint (server runs on port 8001 by default):
```bash
curl http://127.0.0.1:8001/health
```

## MinIO Storage Structure

```
shadow-collector/
├── detection/
│   └── 2026-01/
│       └── {category1}/{category2}/
│           ├── {filename}       # Original image
│           └── {filename}.json  # Metadata
├── text-qa/
│   └── 2026-01/
│       └── {taskId}/
│           ├── {filename}       # Original file
│           └── {filename}.json  # QA data
└── classify/
    └── 2026-01/
        └── {taskId}/
            ├── {filename}       # Original image
            └── {filename}.json  # Classification labels
```

## Migration

Migrate files from old directory structure to new category-based structure.

### Prerequisites

- MinIO connection configured via environment variables
- `docs/classes.csv` - Category mapping file
- `logs/obj.json` - Object list (for initial migration)

### Local Usage

```bash
# Preview changes (dry run)
bun run migrate -- --dry-run

# Run migration
bun run migrate

# Verbose output
bun run migrate -- --verbose

# Reclassify uncategorized files only
bun run migrate -- --reclassify

# List uncategorized files without migrating
bun run migrate -- --list-uncategorized
```

### Docker Compose Usage

#### 1. Prepare obj.json (export object list from MinIO)

```bash
docker run --rm --network shadow-collector_shadow-network minio/mc \
  sh -c "mc alias set myminio http://minio:9000 minioadmin minioadmin && \
         mc ls myminio/shadow-collector --recursive --json" > logs/obj.json
```

#### 2. Run migration

```bash
# Dry run (preview changes)
docker compose exec api bun run migrate -- --dry-run --verbose

# Execute migration
docker compose exec api bun run migrate -- --verbose

# Reclassify uncategorized files only
docker compose exec api bun run migrate -- --reclassify --verbose

# List uncategorized files
docker compose exec api bun run migrate -- --list-uncategorized
```

### Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without executing |
| `--verbose, -v` | Show detailed output |
| `--obj-list <path>` | Path to obj.json file (default: `/app/logs/obj.json`) |
| `--classes <path>` | Path to classes.csv file (default: `/docs/classes.csv`) |
| `--reclassify` | Re-process uncategorized files only |
| `--list-uncategorized` | List uncategorized files without migrating |
