# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShadowCollector is a Chrome extension (Manifest V3) that intercepts and collects HTTP request/response data from data labeling platforms, forwarding captured data to a local Bun.js backend with MinIO storage.

## Development

**No build system** - This is a vanilla JavaScript Chrome extension.

To develop:
1. Load the extension in Chrome at `chrome://extensions/` (enable Developer mode)
2. Click "Load unpacked" and select this directory
3. After code changes, click the reload button on the extension card

Backend server runs at `http://127.0.0.1:8001` with endpoints:
- `GET /health` - Health check
- `POST /api/v1/label/detection` - Object detection / multimodal annotations
- `POST /api/v1/label/text-qa` - Text quality assurance
- `POST /api/v1/label/classify` - Image classification
- `POST /api/v1/label/qa-pair` - Question-answer pair annotations

## Architecture

```
manifest.json              # Extension config, permissions, entry points
    │
    ├── background.js      # Service worker: receives LABEL_DATA messages, forwards to backend
    │
    ├── content.js         # Injects interceptor.js into page's main world
    │       │
    │       └── interceptor.js  # Hooks fetch/XHR, captures traffic, sends to background
    │
    ├── options.html/js/css    # Extension settings page (server URL, allowed URLs)
    │
    └── api/                   # Bun.js + Hono backend
        └── src/
            ├── index.ts       # Main entry, routes setup
            ├── routes/        # Endpoint handlers (detection, text-qa, classify, qa-pair)
            ├── services/      # MinIO storage service
            └── config/        # Environment configuration
```

**Data Flow**: Page network activity → interceptor.js hooks → content.js relay → background.js (`LABEL_DATA` message) → Bun.js backend → MinIO storage

**Key Pattern**: `content.js` injects `interceptor.js` as a `<script>` tag to run in the page's main world context (not the isolated content script context). This allows overriding global `fetch` and `XMLHttpRequest`.

## File Details

- **interceptor.js**: Core logic. Wraps `window.fetch` and `XMLHttpRequest.prototype.open/send`. Matches API patterns for 4 workflow types, caches list responses to pair with subsequent label submissions, includes IP detection via WebRTC and timestamps.

- **background.js**: Single message type `LABEL_DATA` with `workflowType` field. Downloads files via URL and uploads as multipart/form-data to the appropriate endpoint. Caches server URL from extension settings.

- **options.js**: Extension settings page. Configures backend server URL and allowed URL list for selective injection (supports wildcard patterns).

- **api/**: Bun.js + Hono backend. Handles multipart uploads with Zod validation, stores files and metadata in MinIO object storage.

## Workflow Types

The interceptor recognizes 4 workflow types by matching URL patterns:

| Workflow | List API (cached) | Label API (triggers upload) |
|----------|-------------------|----------------------------|
| DETECTION | `/api/sampleListOfTask` | `/api/updateLabelInfo/{taskId}/{imageId}/label` |
| TEXT_QA | `/api/get_json/{fileId}` | `/api/save_json/{fileId}` |
| CLASSIFY | `/api/classifyTasksList/{taskId}/{page}` | `/api/classifyTaskDataLabel/{taskId}/{imageId}` |
| QA_PAIR | `/api/txt_label_task/review/get_data_by_file` | `/api/txt_label_task/review/update_qa_data` |

## Configuration

**Extension Settings** (Options page):
- Server URL (default: `http://127.0.0.1:8001`)
- Allowed URL list (one pattern per line, supports `*` wildcards)

**Backend Environment Variables** (api/.env):
- `PORT` - Server port (default: 8001)
- `MINIO_ENDPOINT` - MinIO server URL
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` - MinIO credentials
- `MINIO_BUCKET` - Storage bucket name
- `MINIO_REGION` - MinIO region

## Deployment

Use Docker Compose for production deployment:

```bash
docker-compose up -d
```

This starts:
- `shadow-collector-api` - Bun.js backend on port 8001
- `shadow-collector-minio` - MinIO storage on ports 9000 (API) and 9001 (console)
- `shadow-collector-minio-init` - Auto-creates the storage bucket
