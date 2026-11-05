export type AiProvider = "deepseek" | "doubao" | "dashscope" | "moonshot" | "custom";

export const providerPresets: Record<AiProvider, { label: string; baseUrl: string; model: string; hint: string }> = {
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", hint: "DeepSeek 官方 OpenAI 兼容接口" },
  doubao: { label: "豆包 / 火山方舟", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "", hint: "填写火山方舟控制台的模型 ID 或 Endpoint ID" },
  dashscope: { label: "阿里百炼 / 通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", hint: "阿里百炼 OpenAI 兼容模式" },
  moonshot: { label: "Kimi / Moonshot", baseUrl: "https://api.moonshot.cn/v1", model: "kimi-k3.1-pro", hint: "填写 API 模型 ID，例如 kimi-k3.1-pro；可获取平台模型列表后选择" },
  custom: { label: "自定义 OpenAI 兼容", baseUrl: "", model: "", hint: "适用于企业网关或其他兼容服务" },
};
