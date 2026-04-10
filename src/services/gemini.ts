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
