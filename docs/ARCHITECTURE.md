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
