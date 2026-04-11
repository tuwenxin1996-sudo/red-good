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
  const result = await callProxy("analyze", { imageBase64 });
  // Validation safety net
  return {
    category: result?.category || "未知品类",
    features: Array.isArray(result?.features) ? result.features : [],
    description: result?.description || "",
    lighting: result?.lighting || "标准光影",
    material: result?.material || "未知材质"
  };
}

// Agent B: Designer
export async function suggestDesign(analysis: SceneAnalysis): Promise<DesignTheme[]> {
  const result = await callProxy("suggest", { analysis });
  const themes = Array.isArray(result) ? result : (Array.isArray(result?.themes) ? result.themes : []);
  
  if (themes.length === 0) {
    // Return at least one default theme to prevent UI from breaking
    return [{
      name: "极简纯白",
      description: "干净清爽的纯白摄影棚背景，强调产品本身。",
      colorPalette: ["#FFFFFF", "#F5F5F5"],
      visualElements: ["柔光箱", "无缝背景纸"],
      mood: "Minimalist"
    }];
  }

  return themes.map((t: any) => ({
    name: t?.name || "未命名主题",
    description: t?.description || "",
    colorPalette: Array.isArray(t?.colorPalette) ? t.colorPalette : ["#CCCCCC"],
    visualElements: Array.isArray(t?.visualElements) ? t.visualElements : [],
    mood: t?.mood || "Neutral"
  }));
}

// Agent C: Marketing
export async function generateMarketing(analysis: SceneAnalysis, theme: DesignTheme): Promise<MarketingCopy> {
  const result = await callProxy("marketing", { analysis, theme });
  return {
    title: result?.title || "精选好物分享",
    hooks: Array.isArray(result?.hooks) ? result.hooks : [],
    body: result?.body || "这是一篇关于产品的精彩介绍...",
    tags: Array.isArray(result?.tags) ? result.tags : ["电商", "设计", "AI"]
  };
}

// Agent D: Visual Generator
export async function generateProductImage(imageBase64: string, analysis: SceneAnalysis, theme: DesignTheme): Promise<string> {
  try {
    const result = await callProxy("generate_image", { imageBase64, analysis, theme });
    if (!result?.image) throw new Error("API 未返回有效图片数据");
    return result.image;
  } catch (e) {
    console.error("Generator failed, falling back to original image", e);
    // If generation fails, we fallback to the original image so the UI doesn't crash or go blank
    return `data:image/jpeg;base64,${imageBase64}`;
  }
}
