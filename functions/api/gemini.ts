import { GoogleGenAI, Type } from "@google/genai";

interface Env {
  GEMINI_API_KEY: string;
  VOLCENGINE_API_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured on server" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const body: any = await request.json();
  const { action, payload } = body;

  try {
    switch (action) {
      case "analyze": {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: payload.imageBase64,
              },
            },
            {
              text: "你是一位资深的电商场景分析专家。请分析这张产品照片，识别产品品类、核心视觉特征、当前光影条件以及材质纹理。请用中文返回结果，并符合 JSON 格式。",
            }
          ],
          config: {
            responseMimeType: "application/json",
          }
        });
        
        return new Response(response.text, {
          headers: { "Content-Type": "application/json" },
        });
      }

      case "suggest": {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `你是一位高端电商视觉设计师。基于以下产品分析：${JSON.stringify(payload.analysis)}，请建议 3 种能让该产品看起来更高端的审美场景（如：极简北欧风、赛博朋克风、禅意风、奢华金等）。对于每个主题，请提供名称、描述、配色方案、关键视觉元素和整体氛围。请用中文返回 JSON 数组。`,
          config: {
            responseMimeType: "application/json",
          }
        });
        return new Response(response.text, {
          headers: { "Content-Type": "application/json" },
        });
      }

      case "marketing": {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `你是一位小红书营销专家。基于这款产品：${payload.analysis.description} 以及选定的视觉主题：${payload.theme.name}（${payload.theme.description}），请生成一篇爆款营销帖子。包括一个吸睛的标题、3 个情感钩子、带有表情符号的正文内容以及相关的标签。请用中文返回 JSON。`,
          config: {
            responseMimeType: "application/json",
          }
        });
        return new Response(response.text, {
          headers: { "Content-Type": "application/json" },
        });
      }

      case "generate_image": {
        if (!env.VOLCENGINE_API_KEY) {
          return new Response(JSON.stringify({ error: "VOLCENGINE_API_KEY not configured on server" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const prompt = `你是一位顶尖的电商摄影师和后期修图师。请保留图中产品的主体，完全不要改变产品的外观、形状和细节。
          请将背景替换为一个专业、高端的电商背景，风格必须符合“${payload.theme.name}”：${payload.theme.description}。
          视觉元素应包含：${payload.theme.visualElements.join('、')}。
          整体色调应符合：${payload.theme.colorPalette.join('、')}。
          光影要求：${payload.analysis.lighting}。
          最终效果应该像是在专业影棚拍摄的爆款详情页主图。`;

        const volcRes = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
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
