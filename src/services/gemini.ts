export interface SceneAnalysis {
  category: string;
  features: string[];
  description: string;
  lighting: string;
  material: string;
}

export interface DesignTheme {
  name: string;
  description: string;
  colorPalette: string[];
  visualElements: string[];
  mood: string;
}

export interface MarketingCopy {
  title: string;
  hooks: string[];
  body: string;
  tags: string[];
}

export interface EngineResult {
  analysis: SceneAnalysis;
  themes: DesignTheme[];
  marketing: MarketingCopy;
}

async function callProxy(action: string, payload: any) {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "请求失败");
  }

  return response.json();
}

// Agent A: Scene Analyzer
export async function analyzeScene(imageBase64: string): Promise<SceneAnalysis> {
  return await callProxy("analyze", { imageBase64 });
}

// Agent B: Designer
export async function suggestDesign(analysis: SceneAnalysis): Promise<DesignTheme[]> {
  return await callProxy("suggest", { analysis });
}

// Agent C: Marketing
export async function generateMarketing(analysis: SceneAnalysis, theme: DesignTheme): Promise<MarketingCopy> {
  return await callProxy("marketing", { analysis, theme });
}

// Agent D: Visual Generator
export async function generateProductImage(imageBase64: string, analysis: SceneAnalysis, theme: DesignTheme): Promise<string> {
  const result = await callProxy("generate_image", { imageBase64, analysis, theme });
  return result.image;
}
i-2.5-flash-image",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64,
          },
        },
        {
          text: `你是一位顶尖的电商摄影师和后期修图师。请保留图中产品的主体，完全不要改变产品的外观、形状和细节。
          请将背景替换为一个专业、高端的电商背景，风格必须符合“${theme.name}”：${theme.description}。
          视觉元素应包含：${theme.visualElements.join('、')}。
          整体色调应符合：${theme.colorPalette.join('、')}。
          光影要求：${analysis.lighting}。
          最终效果应该像是在专业影棚拍摄的爆款详情页主图。`,
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("未能生成图像");
}
