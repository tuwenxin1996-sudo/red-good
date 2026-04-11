import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import type { Plugin } from 'vite';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';

/**
 * 专为本地含有 VPN/Clash 环境定制的穿透代理
 * 
 * 核心原理：
 * Node.js 原生的 fetch 由于无法处理 VPN 的 fake-ip 拦截，会在 TLS 层崩溃 (ECONNRESET)。
 * 而通过系统原生的 curl 与 --data-binary 读取物理文件的方式，可以完美绕过此限制并支持超大 (大图) 的数据传输。
 * 这个 Hack 仅供开发期间使用，生产环境将使用正常的 Cloudflare Functions (functions/api/gemini.ts)。
 */
function volcengineVPNBypassProxy(): Plugin {
  return {
    name: 'volcengine-vpn-bypass',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/gemini' || req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            // 加载环境变量
            const dotenv = await import('dotenv');
            const envConfig = dotenv.config({ path: path.resolve(process.cwd(), '.env') });
            const VOLCENGINE_API_KEY = envConfig.parsed?.VOLCENGINE_API_KEY || process.env.VOLCENGINE_API_KEY || '';
            const VOLCENGINE_ENDPOINT_ID = envConfig.parsed?.VOLCENGINE_ENDPOINT_ID || process.env.VOLCENGINE_ENDPOINT_ID || '';

            if (!VOLCENGINE_API_KEY || !VOLCENGINE_ENDPOINT_ID) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: '环境变量缺失：请检查 .env 文件中的 VOLCENGINE_API_KEY 和 VOLCENGINE_ENDPOINT_ID' }));
              return;
            }

            const { action, payload } = JSON.parse(body);
            const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
            let apiUrl = `${BASE_URL}/chat/completions`;
            let apiBody: any;

            // 路由不同的 Agent Logic
            switch (action) {
              case 'analyze':
                apiBody = {
                  model: VOLCENGINE_ENDPOINT_ID,
                  messages: [
                    { role: 'system', content: '你是一位资深的电商产品经理和视觉质检师。仔细观察产品照片，精确提取结构化核心数据。严格按照 JSON 格式输出，不要包含 markdown 代码块标签。' },
                    { role: 'user', content: [
                      { type: 'text', text: '请仔细分析这张产品照片，提取以下信息并以 JSON 格式返回：\n1. "category": 产品品类\n2. "description": 产品一句话概述\n3. "material": 详细材质描述\n4. "features": 核心视觉特征数组\n5. "lighting": 当前光影环境描述' },
                      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${payload.imageBase64}` } }
                    ]}
                  ],
                  stream: false,
                  response_format: { type: 'json_object' }
                };
                break;
                
              case 'suggest':
                apiBody = {
                  model: VOLCENGINE_ENDPOINT_ID,
                  messages: [
                    { role: 'system', content: '你是一位国际顶尖的电商视觉美术指导。根据产品特性设计 3 套高端视觉方案。严格按照 JSON 格式输出数组，不要包含 markdown 代码块标签。' },
                    { role: 'user', content: `产品分析：${JSON.stringify(payload.analysis)}\n\n请设计 3 套高端审美场景方案，返回一个 JSON 数组 []，每个元素包含：\n1. "name": 主题名称\n2. "description": 详细视觉描述\n3. "colorPalette": Hex颜色代码数组\n4. "visualElements": 关键视觉元素数组\n5. "mood": 整体氛围关键词` }
                  ],
                  stream: false,
                  response_format: { type: 'json_object' }
                };
                break;
                
              case 'marketing':
                apiBody = {
                  model: VOLCENGINE_ENDPOINT_ID,
                  messages: [
                    { role: 'system', content: '你是一位小红书百万粉丝种草博主和电商营销专家。严格按照 JSON 格式输出，不要包含 markdown 代码块标签。' },
                    { role: 'user', content: `产品：${payload.analysis.category} - ${payload.analysis.description || ''}\n材质：${payload.analysis.material}\n特征：${payload.analysis.features.join('、')}\n视觉主题：${payload.theme.name} - ${payload.theme.description}\n\n生成小红书爆款帖子 JSON：\n1. "title": 吸睛标题带Emoji\n2. "hooks": 3个情感钩子数组\n3. "body": 正文300-500字带Emoji\n4. "tags": 8-10个标签数组` }
                  ],
                  stream: false,
                  response_format: { type: 'json_object' }
                };
                break;
                
              case 'generate_image':
                apiUrl = `${BASE_URL}/images/generations`;
                apiBody = {
                  model: 'doubao-seedream-5-0-260128',
                  prompt: `商业电商产品摄影，"${payload.theme.name}"风格场景。${payload.theme.description}。包含：${payload.theme.visualElements.join('、')}。色调：${payload.theme.colorPalette.join('、')}。光影：${payload.analysis.lighting}。专业影棚级电商主图，产品主体清晰锐利。`,
                  response_format: 'b64_json',
                  size: '2048x2048'
                };
                break;
                
              default:
                res.writeHead(400); res.end(JSON.stringify({ error: '未知操作' })); return;
            }

            console.log(`[VPN Bypass Fetcher] 正在调用火山引擎: ${action}...`);
            
            // 使用物理文件传递大体积 JSON 规避 Node/Shell 缓冲区溢出和特殊字符问题
            const tmpFile = path.join(os.tmpdir(), `volc_${Date.now()}_${Math.floor(Math.random()*1000)}.json`);
            fs.writeFileSync(tmpFile, JSON.stringify(apiBody));

            try {
              // 关键修复点：使用 curl --data-binary 读取物理文件，彻底绕过 Node.js TLS 和 stdin pipe 不稳定的痼疾
              const curlResult = execSync(
                `curl -s --max-time 150 -X POST "${apiUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer ${VOLCENGINE_API_KEY}" --data-binary @"${tmpFile}"`,
                { encoding: 'utf-8', maxBuffer: 150 * 1024 * 1024 } // 满载允许 150MB 结果缓冲
              );
              
              const apiData = JSON.parse(curlResult);
              if (apiData.error) throw new Error(apiData.error.message || JSON.stringify(apiData.error));

              let result: string;
              if (action === 'generate_image') {
                const b64 = apiData.data?.[0]?.b64_json;
                const url = apiData.data?.[0]?.url;
                result = JSON.stringify(b64 ? { image: `data:image/png;base64,${b64}` } : { image: url });
              } else {
                let content = apiData.choices[0].message.content;
                // 去除可能产生的 markdown 标签
                if (content.startsWith('```json')) content = content.replace(/```json\n?/, '').replace(/```\n?$/, '');
                
                if (action === 'suggest') {
                  try {
                    const parsed = JSON.parse(content);
                    // 兼容格式抖动
                    if (!Array.isArray(parsed)) {
                      const arr = Object.values(parsed).find(v => Array.isArray(v));
                      if (arr) content = JSON.stringify(arr);
                    }
                  } catch (e) {
                    console.log("[Dev Proxy] 无法解析 suggest JSON", content.substring(0, 100));
                  }
                }
                result = content;
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(result);
              console.log(`[VPN Bypass Fetcher] ${action} 调用成功 ✓`);
            } catch (curlError: any) {
              console.error('[VPN Bypass Fetcher] Curl Error:', curlError.stderr || curlError.message);
              throw new Error(`底层穿越失败: ${curlError.stderr || curlError.message}`);
            } finally {
              // 清理临时文件
              try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);  } catch {}
            }
          } catch (e: any) {
            console.error('[VPN Bypass Fetcher] 顶层捕获:', e.message);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: e.message }));
            }
          }
        });
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [volcengineVPNBypassProxy(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      port: 3000,
    },
  };
});
