# Experiential Memory (Pitfalls & Playbooks)

# 示例
## [2026-03-07] Go build 在当前工作区会因为 VCS stamping 失败
**Trigger**: 在 `/Users/zh/project/githubProj/stock-market-simulator/server` 里执行 `go build ./...`  
**Symptom**: 报错 `error obtaining VCS status: exit status 128`，并提示 `Use -buildvcs=false to disable VCS stamping.`  
**Diagnosis**: 直接运行 `cd server && GOTOOLCHAIN=go1.26.0 go build ./...`；如果立刻出现上述报错，说明当前工作区不能被 Go 正常识别为可取 VCS 元数据的仓库根。  
**Fix**: 使用 `cd server && GOTOOLCHAIN=go1.26.0 go build -buildvcs=false ./...` 完成构建验证。  
**Prevention**: 在这个工作区里把 `-buildvcs=false` 作为 backend 构建/验证命令的默认参数，除非后续仓库根结构被修正。  

## [2026-04-03] Mercruiser 的 `next dev` 与 `next build` 不能并行共享同一个 `.next`
**Trigger**: 在 `/Users/zh/project/githubProj/Mercruiser/Mercruiser` 里一边保持 `npm run dev` 运行，一边执行 `npm run build`，或在 dev 冷启动/重编译阶段连续触发页面请求。  
**Symptom**: 构建或运行时出现 `.next/routes-manifest.json`、`.next/server/app-paths-manifest.json`、`*.nft.json` 缺失，或报 `Cannot find module './vendor-chunks/lucide-react.js'`、`Failed to copy traced files`、页面 `500/Internal Server Error`。  
**Diagnosis**: 先确认不是代码错误，再检查是否同时存在 `next dev`/`next build` 进程，或 `.next` 是否在一个进程仍在使用时被另一个流程清理/重写。  
**Fix**: 停掉所有 `next dev`/`next build` 进程，必要时清理 `.next`，然后按顺序重新验证：先单独运行 `npm run typecheck` 与 `npm run build`，确认通过后，再重新启动 `npm run dev` 做 CDP/UI 验证。  
**Prevention**: 在这个仓库里把验证顺序固定为“静态验证在前，浏览器验证在后”；不要让 `next build` 和 `next dev` 并行操作同一个 `.next` 目录。  

## [2026-04-06] 本仓库如果沿用全局 `npmmirror` registry，`npm install` 可能因为旧镜像缺包而失败
**Trigger**: 在 `/Users/zh/project/mercruiser-studio` 中执行 `npm install`，而本机 `npm config get registry` 返回 `https://registry.npmmirror.com`。  
**Symptom**: 安装过程中报 `E404`，并指向 `https://cdn.npmmirror.com/packages/.../caniuse-lite-...tgz` 不存在。  
**Diagnosis**: 先执行 `npm config get registry` 确认当前 registry；如果是 `npmmirror`，再看报错是否是 tarball 404，而不是普通的 semver 冲突。  
**Fix**: 用官方 registry 安装并重写锁文件：`npm install --registry=https://registry.npmjs.org`。  
**Prevention**: 在这个仓库做依赖安装和锁文件更新时，优先显式指定官方 registry，避免被全局 npm 配置污染。  
