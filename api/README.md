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

### 标准路径格式

```
{type}/{YYYY-MM}/{category1}/{category2}/{filename}
```

### 非合规路径类型

| 类型 | 路径格式 | 描述 |
|------|----------|------|
| `old-taskid` | `{type}/{YYYY-MM-DD}/{32-char-hex-taskId}/{filename}` | 旧版按 taskId 组织的路径 |
| `old-flat` | `{type}/{YYYY-MM-DD}/{filename}` | 旧版扁平路径 |
| `url-encoded-root` | `%2F...` (bucket 根目录) | URL 编码的路径文件 |

### 命令选项

| 选项 | 描述 |
|------|------|
| `--dry-run` | 预览变更，不执行 |
| `--verbose, -v` | 显示详细输出 |
| `--scan-all` | 扫描所有文件，自动检测并迁移非合规路径 |
| `--list-non-compliant` | 列出非合规文件，不执行迁移 |
| `--reclassify` | 仅重新分类未分类文件 |
| `--list-uncategorized` | 列出未分类文件，不执行迁移 |
| `--obj-list <path>` | obj.json 文件路径 (默认: `/app/logs/obj.json`) |
| `--classes <path>` | classes.csv 文件路径 (默认: `/docs/classes.csv`) |

### 生产环境使用 (Docker Compose)

#### 常用操作

```bash
# 1. 列出非合规文件
docker compose exec api bun run migrate -- --list-non-compliant

# 2. 预览迁移 (dry-run)
docker compose exec api bun run migrate -- --scan-all --dry-run --verbose

# 3. 执行迁移
docker compose exec api bun run migrate -- --scan-all --verbose

# 4. 列出未分类文件
docker compose exec api bun run migrate -- --list-uncategorized

# 5. 重新分类未分类文件
docker compose exec api bun run migrate -- --reclassify --verbose
```

#### 初始迁移（需要 obj.json）

如果需要使用 obj.json 进行初始迁移：

```bash
# 1. 导出对象列表
docker run --rm --network shadow-collector_shadow-network minio/mc \
  sh -c "mc alias set myminio http://minio:9000 minioadmin minioadmin && \
         mc ls myminio/shadow-collector --recursive --json" > logs/obj.json

# 2. 执行初始迁移
docker compose exec api bun run migrate -- --verbose
```

### 本地开发使用

```bash
# 列出非合规文件
bun run migrate -- --list-non-compliant

# 预览迁移
bun run migrate -- --scan-all --dry-run --verbose

# 执行迁移
bun run migrate -- --scan-all --verbose

# 列出未分类文件
bun run migrate -- --list-uncategorized

# 重新分类未分类文件
bun run migrate -- --reclassify --verbose
```

**注意**: 如果配置了代理 (如 socks5)，需要绑定本地 MinIO 访问：

```bash
NO_PROXY=127.0.0.1 ALL_PROXY= bun run migrate -- --scan-all
```
