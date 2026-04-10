# AI 电商视觉引擎 (Cloudflare Edition)

本项目已优化并包装为可直接在 Cloudflare Pages 运行的全套代码，采用 Pages Functions 技术实现了 API 密钥的后端隐藏。

## 本地运行

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **配置环境变量**:
   将项目根目录下的 `.env` 文件中的 `GEMINI_API_KEY` 替换为你的密钥。

3. **地模拟 Cloudflare 环境**:
   ```bash
   npx wrangler pages dev dist
   ```
   *注意：这会同时启动前端和 API 代理函数。*

## Cloudflare 部署指引 (GitHub 方式)

### 1. 提交代码到 GitHub
将本项目的所有代码推送到你的 GitHub 仓库。

### 2. 在 Cloudflare 创建 Pages 项目
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
3. 选择你的仓库，点击 **Begin setup**。

### 3. 配置构建设置
- **Framework preset**: `Vite` (或其他，基本会自动识别)
- **Build command**: `npm run build`
- **Build output directory**: `dist`

### 4. 设置 API KEY (关键步骤)
**必须在 Dashboard 中设置密钥，否则 API 无法运行：**
1. 部署完成后，在 Pages 项目详情页点击 **Settings** 选项卡。
2. 选择左侧的 **Functions**。
3. 在 **Environment variables** 部分，点击 **Add variable**。
4. 变量名填入：`GEMINI_API_KEY`。
5. 变量值填入：你的实际 Gemini API Key。
6. **重要**：设置完成后，需要**重新触发一次部署**（点击 Deployments -> 在最新部署旁选择 Retry）以使变量生效。

---

## 项目架构说明

- `/src`: React 前端代码。
- `/functions/api`: Cloudflare Pages Functions，负责作为后端代理调用 Gemini，确保 API Key 不会泄露到浏览器。
- `wrangler.toml`: Cloudflare 项目配置文件。
