interface Env {
  VOLCENGINE_API_KEY: string;
  VOLCENGINE_ENDPOINT_ID: string;
}

/**
 * 带超时控制的 fetch 封装
 * 防止因网络问题导致请求无限期挂起
 */
async function fetchWithTimeout(url: string, options: any, timeoutMs = 60000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.VOLCENGINE_API_KEY || !env.VOLCENGINE_ENDPOINT_ID) {
    return new Response(JSON.stringify({ error: "服务器配置缺失: VOLCENGINE_API_KEY 或 VOLCENGINE_ENDPOINT_ID 未设置" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body: any = await request.json();
  const { action, payload } = body;
  const BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

  // 公共请求头
  const commonHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${env.VOLCENGINE_API_KEY}`,
  };

  try {
    console.log(`[Worker] 动作: ${action}`);

    switch (action) {

      // =====================================================
      // 步骤 1：智能体 A —— 场景分析师 (Scene Analyzer)
      // 模型：doubao-seed-2-0-lite-260215（通过 Endpoint ID 调用）
      // 角色：产品经理 + 质检员
      // =====================================================
      case "analyze": {
        console.log("[Agent A] 场景分析师启动...");
        const response = await fetchWithTimeout(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: commonHeaders,
          body: JSON.stringify({
            model: env.VOLCENGINE_ENDPOINT_ID,
            messages: [
              {
                role: "system",
                content: "你是一位资深的电商产品经理和视觉质检师。你的任务是仔细观察产品照片，精确提取出结构化的核心数据，为下游的设计师和修图师提供客观、专业的产品特征报告。你必须严格按照 JSON 格式输出，不要包含任何 markdown 代码块标签或其他文字说明。"
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `请仔细分析这张产品照片，提取以下信息并以 JSON 格式返回：
1. "category": 产品品类（例如："陶瓷咖啡杯"、"真皮手提包"）
2. "description": 产品的一句话概述（例如："一款极简风格的白色陶瓷咖啡杯，带有哑光质感"）
3. "material": 详细的材质描述（例如："哑光釉面，带有粗糙颗粒感"）
4. "features": 核心视觉特征数组（例如：["极简手柄", "大地色系", "圆润杯口"]）
5. "lighting": 当前照片的光影环境描述（例如："自然侧面柔光，阴影偏冷调"）`
                  },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${payload.imageBase64}` }
                  }
                ]
              }
            ],
            stream: false,
            response_format: { type: "json_object" }
          })
        }, 60000);

        if (!response.ok) {
          const errText = await response.text();
          console.error("[Agent A] 错误:", errText);
          throw new Error(`场景分析失败 (${response.status}): ${errText}`);
        }
        const data: any = await response.json();
        console.log("[Agent A] 分析完成");
        return new Response(data.choices[0].message.content, { headers: { "Content-Type": "application/json" } });
      }

      // =====================================================
      // 步骤 2：智能体 B —— 审美设计师 (Designer)
      // 模型：doubao-seed-2-0-lite-260215（通过 Endpoint ID 调用）
      // 角色：美术指导
      // =====================================================
      case "suggest": {
        console.log("[Agent B] 审美设计师启动...");
        const response = await fetchWithTimeout(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: commonHeaders,
          body: JSON.stringify({
            model: env.VOLCENGINE_ENDPOINT_ID,
            messages: [
              {
                role: "system",
                content: "你是一位国际顶尖的电商视觉美术指导。你的任务是根据产品的品类和材质特性，头脑风暴出 3 套最适合该产品的高端视觉方案。每套方案必须具有强烈的审美差异化，能让产品在电商平台上脱颖而出。你必须严格按照 JSON 格式输出，不要包含任何 markdown 代码块标签或其他文字说明。"
              },
              {
                role: "user",
                content: `以下是产品的特征分析报告：
${JSON.stringify(payload.analysis, null, 2)}

请基于以上分析，为该产品设计 3 套高端审美场景方案。返回一个 JSON 数组，每个元素包含：
1. "name": 主题名称（例如："侘寂风茶室"、"极简北欧"、"赛博朋克"）
2. "description": 该主题的详细视觉描述（2-3句话）
3. "colorPalette": 色彩规范数组，使用 Hex 颜色代码（例如：["#D2B48C", "#F5F5DC", "#8B7355"]）
4. "visualElements": 关键视觉元素数组（例如：["枯山水", "原木桌面", "斑驳光影"]）
5. "mood": 整体氛围关键词（例如："宁静致远"）

请直接返回 JSON 数组 []，不要嵌套在其他对象中。`
              }
            ],
            stream: false,
            response_format: { type: "json_object" }
          })
        }, 60000);

        if (!response.ok) {
          const errText = await response.text();
          console.error("[Agent B] 错误:", errText);
          throw new Error(`审美设计失败 (${response.status}): ${errText}`);
        }
        const data: any = await response.json();
        console.log("[Agent B] 设计完成");
        
        // 豆包可能返回 { "themes": [...] } 或直接返回 [...]
        let content = data.choices[0].message.content;
        try {
          const parsed = JSON.parse(content);
          // 如果返回的是对象而不是数组，尝试提取数组
          if (!Array.isArray(parsed)) {
            const arrayValue = Object.values(parsed).find(v => Array.isArray(v));
            if (arrayValue) {
              content = JSON.stringify(arrayValue);
            }
          }
        } catch (e) {
          // 如果解析失败，直接传递原始内容
        }
        
        return new Response(content, { headers: { "Content-Type": "application/json" } });
      }

      // =====================================================
      // 步骤 3：智能体 D —— 视觉生成师 (Visual Generator)
      // 模型：doubao-seedream-5-0-260128
      // 角色：商业修图师
      // =====================================================
      case "generate_image": {
        console.log("[Agent D] 视觉生成师启动...");
        
        // 拼接精准的生图 Prompt
        const prompt = `商业电商产品摄影，保留产品主体不变，将背景替换为"${payload.theme.name}"风格场景。
场景描述：${payload.theme.description}
包含视觉元素：${payload.theme.visualElements.join('、')}
整体色调：${payload.theme.colorPalette.join('、')}
光影要求：匹配${payload.analysis.lighting}
最终效果：专业影棚级别的电商爆款详情页主图，产品主体清晰锐利，背景自然融合，光影过渡流畅。`;

        const response = await fetchWithTimeout(`${BASE_URL}/images/generations`, {
          method: "POST",
          headers: commonHeaders,
          body: JSON.stringify({
            model: "doubao-seedream-5-0-260128",
            prompt: prompt,
            response_format: "b64_json",
            size: "1024x1024"
          })
        }, 120000); // 生图给更长的超时时间

        if (!response.ok) {
          const errText = await response.text();
          console.error("[Agent D] 错误:", errText);
          throw new Error(`图片生成失败 (${response.status}): ${errText}`);
        }

        const data: any = await response.json();
        const generatedB64 = data.data?.[0]?.b64_json;
        const generatedUrl = data.data?.[0]?.url;

        if (generatedB64) {
          console.log("[Agent D] 生成完成 (base64)");
          return new Response(JSON.stringify({ image: `data:image/png;base64,${generatedB64}` }), {
            headers: { "Content-Type": "application/json" },
          });
        } else if (generatedUrl) {
          console.log("[Agent D] 生成完成 (url)");
          return new Response(JSON.stringify({ image: generatedUrl }), {
            headers: { "Content-Type": "application/json" },
          });
        } else {
          throw new Error("火山引擎未返回有效的图像数据");
        }
      }

      // =====================================================
      // 步骤 4：智能体 C —— 营销策划师 (Marketing Strategist)
      // 模型：doubao-seed-2-0-lite-260215（通过 Endpoint ID 调用）
      // 角色：小红书爆款写手
      // =====================================================
      case "marketing": {
        console.log("[Agent C] 营销策划师启动...");
        const response = await fetchWithTimeout(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: commonHeaders,
          body: JSON.stringify({
            model: env.VOLCENGINE_ENDPOINT_ID,
            messages: [
              {
                role: "system",
                content: "你是一位在小红书拥有百万粉丝的顶级种草博主和电商营销专家。你擅长用感性的文案打动消费者，制造购买欲望。你的文案风格：真诚但不做作，有温度但有节制，善用 Emoji 增添活力但不过度堆砌。你必须严格按照 JSON 格式输出，不要包含任何 markdown 代码块标签或其他文字说明。"
              },
              {
                role: "user",
                content: `产品信息：
- 品类：${payload.analysis.category}
- 描述：${payload.analysis.description || payload.analysis.category}
- 材质：${payload.analysis.material}
- 核心特征：${payload.analysis.features.join('、')}

当前视觉主题：${payload.theme.name}
主题氛围：${payload.theme.description}

请基于以上信息，生成一篇小红书爆款营销帖子，返回 JSON 格式：
1. "title": 吸睛标题（15-25字，带 1-2 个 Emoji）
2. "hooks": 3 个情感钩子数组（每个钩子是一句能引发共鸣的话，带 Emoji）
3. "body": 正文内容（300-500字，分段落，带 Emoji，语气亲切自然）
4. "tags": 8-10 个相关热门标签数组（不带 # 号）`
              }
            ],
            stream: false,
            response_format: { type: "json_object" }
          })
        }, 60000);

        if (!response.ok) {
          const errText = await response.text();
          console.error("[Agent C] 错误:", errText);
          throw new Error(`营销文案生成失败 (${response.status}): ${errText}`);
        }
        const data: any = await response.json();
        console.log("[Agent C] 文案完成");
        return new Response(data.choices[0].message.content, { headers: { "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: `未知操作: ${action}` }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    console.error("[Worker Error]", error);
    const message = error.name === 'AbortError'
      ? "请求超时：火山引擎未在规定时间内响应，请检查网络或稍后重试"
      : error.message;
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
