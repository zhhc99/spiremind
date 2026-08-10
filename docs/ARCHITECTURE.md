# spiremind 架构

## 总览

spiremind 采用 `index.html + TypeScript ESM + esbuild` 的轻量架构.

- `index.html` 提供页面壳和样式
- `src/` 保存源码
- `dist/main.js` 是构建产物

## 目录结构

```text
.
├─ index.html                 # 页面结构, 样式, dist 入口
├─ package.json               # npm scripts 与依赖
├─ tsconfig.json              # TypeScript 配置
├─ src/
│  ├─ main.ts                 # 初始化与模块装配
│  ├─ config.ts               # 角色, 语言, 默认 tier, 文案
│  ├─ state.ts                # 类型, 共享状态, localStorage
│  ├─ api.ts                  # spire-codex 请求与缓存
│  ├─ assets.ts               # API 静态资源到 CDN 的 URL 解析
│  ├─ cards.ts                # 卡牌描述解析与展示数据整理
│  ├─ tierlist.ts             # tier 数据, 简述数据, 导入导出
│  ├─ render.ts               # DOM 渲染
│  └─ interactions.ts         # 拖拽, 搜索, 编辑, 菜单事件
├─ dist/
│  └─ main.js                 # esbuild 输出
```

## 构建

- `npm run build`
  打包 `src/main.ts` 到 `dist/main.js`
- `npm run dev`
  监听源码并重建
- `npm run typecheck`
  运行 TypeScript 类型检查

## 约束

- 不引入框架
- 不引入运行时依赖
- 保持模块职责清晰
- 避免过度抽象

## 游戏数据版本

- 应用提供当前稳定版与最新 Beta 两个数据通道.
- 稳定版版本号由 `config.ts` 固定, 随稳定数据升级一同发布.
- Beta 版本号从 `/api/beta/version` 获取, 请求失败时使用配置中的回退值.
- Beta 实体请求统一携带 `channel=beta`; 缓存键包含数据通道与语言.
- Tier 数据按 `数据通道:角色` 隔离, 旧版存储自动迁移到稳定版.
- API 返回的 `/static/images/` 路径由 `assets.ts` 直接映射到 CDN, 避免跨域重定向.
- 角色选择器继续显示各角色的初始遗物; 角色详情与遗物图片请求在会话内缓存.
- 卡图优先使用当前数据通道返回的 `image_url`; Beta 缺图时只按相同卡牌 ID 回退到缓存的 Stable API `image_url`, 仍缺失或加载失败时显示缺图占位. 不猜测 CDN 路径, 也不使用完整卡图回退.
