interface Env {
  GEMINI_API_KEY: string;
  VOLCENGINE_API_KEY: string;
  VOLCENGINE_ENDPOINT_ID: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.VOLCENGINE_API_KEY || !env.VOLCENGINE_ENDPOINT_ID) {
    return new Response(JSON.stringify({ error: "火山引擎配置未在服务端生效，请检查 API Key 和 Endpoint ID" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body: any = await request.json();
  const { action, payload } = body;

  const BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

  try {
    switch (action) {
      case "analyze": {
        // 使用豆包 Vision 模型分析图片
        const response = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.VOLCENGINE_API_KEY}`
          },
          body: JSON.stringify({
            model: env.VOLCENGINE_ENDPOINT_ID,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "你是一位资深的电商场景分析专家。请分析这张产品照片，识别产品品类、核心视觉特征、当前光影条件以及材质纹理。请用中文返回结果，并严格符合 JSON 格式，包含三个根字段：category (品类)、material (描述材质)、features (特征数组)、lighting (光影描述)。不要包含 markdown 代码块标签。"
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${payload.imageBase64}`
                    }
                  }
                ]
              }
            ],
            response_format: { type: "json_object" }
          })
        });

        const data: any = await response.json();
        return new Response(data.choices[0].message.content, {
          headers: { "Content-Type": "application/json" },
        });
      }

      case "suggest": {
        // 使用豆包生成审美建议
        const response = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.VOLCENGINE_API_KEY}`
          },
          body: JSON.stringify({
            model: env.VOLCENGINE_ENDPOINT_ID,
            messages: [
              {
                role: "user",
                content: `你是一位高端电商视觉设计师。基于以下产品分析：${JSON.stringify(payload.analysis)}，请建议 3 种能让该产品看起来更高端的审美场景（如：极简北欧风、赛博朋克风、禅意风、奢华金等）。对于每个主题，请提供名称、描述、配色方案、关键视觉元素和整体氛围。请用中文返回 JSON 数组。不要包含 markdown 代码块标签。`
              }
            ],
            response_format: { type: "json_object" }
          })
        });

        const data: any = await response.json();
        const content = data.choices[0].message.content;
        // 豆包有时会返回 { "themes": [...] }，前端需要处理
        return new Response(content, {
          headers: { "Content-Type": "application/json" },
        });
      }

      case "marketing": {
        // 使用豆包生成营销文案
        const response = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.VOLCENGINE_API_KEY}`
          },
          body: JSON.stringify({
            model: env.VOLCENGINE_ENDPOINT_ID,
            messages: [
              {
                role: "user",
                content: `你是一位小红书营销专家。基于这款产品：${payload.analysis.description || payload.analysis.category} 以及选定的视觉主题：${payload.theme.name}（${payload.theme.description}），请生成一篇爆款营销帖子。包括一个吸睛的标题 (title)、3 个情感钩子 (hooks 数组)、带有表情符号的正文内容 (body) 以及相关的标签 (tags 数组)。请用中文返回 JSON。不要包含 markdown 代码块标签。`
              }
            ],
            response_format: { type: "json_object" }
          })
        });

        const data: any = await response.json();
        return new Response(data.choices[0].message.content, {
          headers: { "Content-Type": "application/json" },
        });
      }

      case "generate_image": {
        // 使用 Seedream 4.5 生成图像
        const prompt = `你是一位顶尖的电商摄影师和后期修图师。请保留图中产品的主体，完全不要改变产品的外观、形状和细节。
          请将背景替换为一个专业、高端的电商背景，风格必须符合“${payload.theme.name}”：${payload.theme.description}。
          视觉元素应包含：${payload.theme.visualElements.join('、')}。
          整体色调应符合：${payload.theme.colorPalette.join('、')}。
          光影要求：${payload.analysis.lighting}。
          最终效果应该像是在专业影棚拍摄的爆款详情页主图。`;

        const volcRes = await fetch(`${BASE_URL}/images/generations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.VOLCENGINE_API_KEY}`
          },
          body: JSON.stringify({
             model: "doubao-seedream-4-5-251128",
             prompt: prompt,
             image: [`data:image/jpeg;base64,${payload.imageBase64}`],
             response_format: "b64_json"
          })
        });

        if (!volcRes.ok) {
           const errText = await volcRes.text();
           throw new Error(`Volcengine API error: ${errText}`);
        }

        const data: any = await volcRes.json();
        const generatedB64 = data.data?.[0]?.b64_json;
        
        if (!generatedB64) {
            throw new Error("火山引擎接口未正常返回图像数据");
        }

        return new Response(JSON.stringify({ image: `data:image/png;base64,${generatedB64}` }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    console.error("SERVER ERROR:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
