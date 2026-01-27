# MinIO 存储路径改造实现总结

## 实施日期
2026-01-26

## 目标
根据图像标注的目标类别，从 `docs/classes.csv` 查找对应的"专业"和"部件名称/场景分类"，使用这两级分类建立存储目录。

## 新存储路径结构
```
<bucket>/<type>/<YYYY-MM>/<专业>/<部件名称/场景分类>/<filename>.jpg
<bucket>/<type>/<YYYY-MM>/<专业>/<部件名称/场景分类>/<filename>.json
```

### 示例路径
- `shadow-collector/detection/2026-01/设备-输电/避雷器/image001.jpg`
- `shadow-collector/multimodal/2026-01/安监/环境监测/image002.json`
- `shadow-collector/classify/2026-01/设备-配电/断路器/image003.jpg`

## 已实现的功能

### 1. 分类映射工具 (`api/src/utils/category-mapper.ts`)
- ✅ 从 `docs/classes.csv` 加载标签到分类的映射
- ✅ 提取 detection 标注中的 rectanglelabels
- ✅ 将标签数组转换为分类信息（专业、部件名称）
- ✅ 支持去重，返回所有唯一的分类组合

### 2. Label ID 映射工具 (`api/src/utils/label-id-mapper.ts`)
- ✅ 从 `api/assets/label-id-map.json` 加载 ID 到标签的映射
- ✅ 将 classify 请求中的数字 ID 数组转换为标签字符串
- ✅ 对未知 ID 进行告警

### 3. MinIO 服务修改 (`api/src/services/minio.ts`)
- ✅ 替换 `getDatePath()` 为 `getMonthPath()`，返回 YYYY-MM 格式
- ✅ 修改 `storeWithMetadata()` 接收 `labels` 参数
- ✅ 支持多分类存储：为每个唯一分类组合存储一份文件
- ✅ 无匹配时使用 "未分类/未分类" 作为默认分类
- ✅ 返回所有存储路径 (`allPaths`)

### 4. Detection 路由更新 (`api/src/routes/detection.ts`)
- ✅ 导入 `extractLabelsFromAnnotations` 工具
- ✅ 从 annotations 中提取标签
- ✅ 将标签传递给 `storeWithMetadata`
- ✅ 在日志中记录标签和分类数量
- ✅ 在响应中返回 `allPaths`

### 5. Classify 路由更新 (`api/src/routes/classify.ts`)
- ✅ 导入 `getLabelsFromIds` 工具
- ✅ 将 labelIds 转换为标签字符串
- ✅ 将标签传递给 `storeWithMetadata`
- ✅ 在日志中记录标签和分类数量
- ✅ 在响应中返回 `allPaths`

### 6. 服务启动配置 (`api/src/index.ts`)
- ✅ 导入 `loadCategoryMapping` 和 `loadLabelIdMapping`
- ✅ 在启动时加载两个映射表
- ✅ 在 MinIO 连接检查之前完成加载

### 7. Text-QA 和 QA-Pair 路由更新
- ✅ 移除废弃的 `storagePath` 参数
- ✅ 这两个工作流没有标签，使用默认分类 "未分类/未分类"

## 技术细节

### 标签提取逻辑

**目标检测 (detection)**:
```typescript
// annotation 结构
{
  "value": {
    "rectanglelabels": ["021_gt_hd_xs"]
  },
  "type": "rectanglelabels"
}
```

**图像分类 (classify)**:
- 请求发送: `labelIds: [1853, 1827]`
- 后端转换: `["023_dlq_jyh_tl", "023_dlq_jyh_zc"]`

### 多分类处理策略
1. 提取所有唯一标签
2. 查找每个标签对应的分类信息
3. 去重获取所有唯一的 (专业, 部件名称) 组合
4. 为每个分类组合存储一份文件（复制到所有分类）
5. 返回所有存储路径

### 未匹配处理
- 标签在 CSV 中找不到对应分类时，使用 "未分类/未分类"
- 请求中没有标签时，使用 "未分类/未分类"
- 在控制台输出警告信息

## 文件清单

### 新增文件
- 无（category-mapper.ts 和 label-id-mapper.ts 已存在）

### 修改文件
1. `api/src/services/minio.ts` - 核心存储逻辑
2. `api/src/utils/category-mapper.ts` - 路径修复
3. `api/src/utils/label-id-mapper.ts` - 路径修复
4. `api/src/routes/detection.ts` - 标签提取和传递
5. `api/src/routes/classify.ts` - ID 到标签转换
6. `api/src/routes/text-qa.ts` - 移除 storagePath
7. `api/src/routes/qa-pair.ts` - 移除 storagePath
8. `api/src/index.ts` - 启动时加载映射

### 依赖文件
- `docs/classes.csv` - 标签分类映射数据源（1400 行）
- `api/assets/label-id-map.json` - Label ID 映射（已存在）

## 验证方法

### 1. 启动服务器
```bash
cd /Users/leo/Development/repo/shadow-collector/api
bun run dev
```

### 2. 预期启动日志
```
正在检查依赖服务...
正在加载标签分类映射...
✅ 已加载 1400 个标签分类映射 from /Users/leo/Development/repo/shadow-collector/docs/classes.csv
✅ 已加载 XXXX 个 Label ID 映射 from /Users/leo/Development/repo/shadow-collector/api/assets/label-id-map.json
✅ MinIO 连接成功: http://127.0.0.1:9000, bucket: shadow-collector
Starting server on port 8001...
```

### 3. 测试 Detection 请求
发送包含标签的请求，检查：
- 控制台输出: `📊 提取到 X 个标签: ...`
- 存储日志: `✅ 已存储到: detection/2026-01/设备-输电/避雷器/...`
- 响应包含 `allPaths` 字段（多分类时）

### 4. 测试 Classify 请求
发送 labelIds 数组，检查：
- 控制台输出: `📊 将 labelIds [...] 转换为标签: ...`
- 存储日志: `✅ 已存储到: classify/2026-01/.../...`
- 响应包含 `allPaths` 字段（多分类时）

### 5. 验证存储路径
检查 MinIO 控制台 (http://127.0.0.1:9001)：
- 路径格式: `{type}/{YYYY-MM}/{专业}/{部件名称}/{filename}`
- 多分类时文件存在于多个路径
- 未分类文件存储在 `{type}/{YYYY-MM}/未分类/未分类/`

## 代码质量检查
- ✅ TypeScript 编译通过（无错误）
- ✅ 所有路由类型安全
- ✅ 错误处理完整（文件加载失败会抛出异常）
- ✅ 日志输出清晰（标签提取、分类映射、存储路径）

## 未来优化建议
1. 考虑对 CSV 加载进行性能优化（当前每次启动加载）
2. 添加缓存机制避免重复查询
3. 添加监控指标（每个分类的文件数量）
4. 考虑使用数据库替代 CSV 文件（更大规模时）
5. 添加标签验证（检查请求中的标签是否在映射表中）

## 注意事项
- 服务启动时必须能够访问 `docs/classes.csv` 和 `api/assets/label-id-map.json`
- 文件路径使用 `__dirname` 相对定位，确保在任何工作目录下都能正确加载
- 多分类存储会增加存储空间使用（同一文件存储多份）
- Text-QA 和 QA-Pair 工作流使用默认分类（未来可根据需求添加分类逻辑）
