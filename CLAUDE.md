# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShadowCollector is a Chrome extension (Manifest V3) that intercepts and collects HTTP request/response data from data labeling platforms, forwarding captured data to a local Python backend.

## Development

**No build system** - This is a vanilla JavaScript Chrome extension.

To develop:
1. Load the extension in Chrome at `chrome://extensions/` (enable Developer mode)
2. Click "Load unpacked" and select this directory
3. After code changes, click the reload button on the extension card

Backend server must run at `http://127.0.0.1:8001` with endpoints:
- `POST /api/v1/task` - Receives task metadata
- `POST /api/v1/label` - Receives label submissions

## Architecture

```
manifest.json          # Extension config, permissions, entry points
    │
    ├── background.js  # Service worker: receives messages, forwards to backend
    │
    └── content.js     # Injects interceptor.js into page's main world
            │
            └── interceptor.js  # Hooks fetch/XHR, captures traffic, sends to background
```

**Data Flow**: Page network activity → interceptor.js hooks → content.js relay → background.js → Python backend

**Key Pattern**: `content.js` injects `interceptor.js` as a `<script>` tag to run in the page's main world context (not the isolated content script context). This allows overriding global `fetch` and `XMLHttpRequest`.

## File Details

- **interceptor.js**: Core logic. Wraps `window.fetch` and `XMLHttpRequest.prototype.open/send`. Filters out static assets (.css, .js, images). Uses `logTraffic()` for console debugging.

- **background.js**: Message types are `TASK_DATA` and `SUBMIT_DATA`. Maps to different backend endpoints.

- **requests/**: Sample captured request/response data for reference (image classification, object detection, text QA workflows).
