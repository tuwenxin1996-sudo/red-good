import { onRequestPost as __api_gemini_ts_onRequestPost } from "/Volumes/SKHynix/反重力/ai-电商视觉引擎 (1)/functions/api/gemini.ts"

export const routes = [
    {
      routePath: "/api/gemini",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_gemini_ts_onRequestPost],
    },
  ]