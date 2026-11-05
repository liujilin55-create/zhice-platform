import type { EvidenceDatabase } from "./types";

const cachedAt = "2026-10-30T06:00:00.000Z";
const ragQuote = "For language generation tasks, we find that RAG models generate more specific, diverse and factual language than a state-of-the-art parametric-only seq2seq baseline.";
const reactQuote = "In this paper, we explore the use of LLMs to generate both reasoning traces and task-specific actions in an interleaved manner, allowing for greater synergy between the two: reasoning traces help the model induce, track, and update action plans as well as handle exceptions, while actions allow it to interface with external sources, such as knowledge bases or environments, to gather additional information.";
const ruleText = "技术实现需说明 AI 工作流、检索策略与生成结果的验证方式。";
const caseText = "将来源原文、建议和人工确认放在同一条可回看的证据链中。";

export const seedEvidenceDatabase: EvidenceDatabase = {
  version: 1,
  records: [
    {
      id: "paper-rag-grounding", kind: "academicPaper",
      title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
      source: "NeurIPS 2020 · arXiv", sourceMode: "external",
      sourceUrl: "https://arxiv.org/abs/2005.11401",
      occurredAt: "2020-05-22", cachedAt, pageRef: "Abstract",
      tags: ["RAG", "检索增强", "生成质量", "技术实现"],
      status: "confirmed", cacheState: "cached", relevance: 0.96,
      excerpt: "通过检索外部知识辅助生成，为技术路线中的知识更新、来源追溯和事实性提供论文依据。",
      body: "本地保存了 arXiv 摘要原文。该论文可支持采用检索增强架构的技术讨论；项目的实际提升效果仍需通过自己的对照实验验证。",
      highlightedQuotes: [ragQuote],
      academic: {
        authors: ["Patrick Lewis", "Ethan Perez", "Aleksandra Piktus", "等"],
        year: 2020, venue: "NeurIPS 2020", doi: "10.48550/arXiv.2005.11401",
        abstract: "Large pre-trained language models have been shown to store factual knowledge in their parameters, and achieve state-of-the-art results when fine-tuned on downstream NLP tasks. However, their ability to access and precisely manipulate knowledge is still limited, and hence on knowledge-intensive tasks, their performance lags behind task-specific architectures. Additionally, providing provenance for their decisions and updating their world knowledge remain open research problems. Pre-trained models with a differentiable access mechanism to explicit non-parametric memory can overcome this issue, but have so far been only investigated for extractive downstream tasks. We explore a general-purpose fine-tuning recipe for retrieval-augmented generation (RAG) -- models which combine pre-trained parametric and non-parametric memory for language generation. We introduce RAG models where the parametric memory is a pre-trained seq2seq model and the non-parametric memory is a dense vector index of Wikipedia, accessed with a pre-trained neural retriever. We compare two RAG formulations, one which conditions on the same retrieved passages across the whole generated sequence, the other can use different passages per token. We fine-tune and evaluate our models on a wide range of knowledge-intensive NLP tasks and set the state-of-the-art on three open domain QA tasks, outperforming parametric seq2seq models and task-specific retrieve-and-extract architectures. " + ragQuote,
      },
    },
    {
      id: "paper-agent-tool-use", kind: "academicPaper",
      title: "ReAct: Synergizing Reasoning and Acting in Language Models",
      source: "ICLR 2023 · arXiv", sourceMode: "external",
      sourceUrl: "https://arxiv.org/abs/2210.03629",
      occurredAt: "2022-10-07", cachedAt, pageRef: "Abstract",
      tags: ["Agent", "工具调用", "自主规划", "技术实现"],
      status: "pending", cacheState: "cached", relevance: 0.91,
      excerpt: "将推理与动作交替组织，帮助模型利用工具观察结果并调整计划。",
      body: "摘要原文已缓存，待确认是否适合当前项目的任务编排设计。论文中的实验结果不能直接当作本项目的效果。",
      highlightedQuotes: [reactQuote],
      academic: {
        authors: ["Shunyu Yao", "Jeffrey Zhao", "Dian Yu", "等"], year: 2023,
        venue: "ICLR 2023", doi: "10.48550/arXiv.2210.03629",
        abstract: "While large language models (LLMs) have demonstrated impressive capabilities across tasks in language understanding and interactive decision making, their abilities for reasoning (e.g. chain-of-thought prompting) and acting (e.g. action plan generation) have primarily been studied as separate topics. " + reactQuote + " We apply our approach, named ReAct, to a diverse set of language and decision making tasks and demonstrate its effectiveness over state-of-the-art baselines, as well as improved human interpretability and trustworthiness over methods without reasoning or acting components. Concretely, on question answering (HotpotQA) and fact verification (Fever), ReAct overcomes issues of hallucination and error propagation prevalent in chain-of-thought reasoning by interacting with a simple Wikipedia API, and generates human-like task-solving trajectories that are more interpretable than baselines without reasoning traces. On two interactive decision making benchmarks (ALFWorld and WebShop), ReAct outperforms imitation and reinforcement learning methods by an absolute success rate of 34% and 10% respectively, while being prompted with only one or two in-context examples. Project site with code: https://react-lm.github.io/",
      },
    },
    {
      id: "rule-ai-web-score", kind: "competitionRule",
      title: "AI Web 项目评分条款 · 示例",
      source: "产品演示数据 · 非官方比赛文件", sourceMode: "sample",
      occurredAt: "2026-10-30", cachedAt, pageRef: "示例条款",
      tags: ["评分标准", "技术实现", "RAG", "Agent"],
      status: "pending", cacheState: "cached", relevance: 0.99,
      excerpt: ruleText, body: "这是一组交互演示条款，不代表传智杯官方评分细则。上传真实文件后，平台保存解析原文并生成对应证据。",
      highlightedQuotes: [ruleText],
      ruleItems: [
        { label: "技术实现", text: ruleText, page: "示例第 1 条", scoreWeight: "权重待核对" },
        { label: "交互创新", text: "说明用户如何从 AI 建议返回来源，并核验其依据。", page: "示例第 2 条" },
      ],
    },
    {
      id: "rule-submission", kind: "competitionRule",
      title: "提交物与时间节点 · 示例",
      source: "产品演示数据 · 非官方比赛文件", sourceMode: "sample",
      occurredAt: "2026-10-30", cachedAt, pageRef: "示例条款",
      tags: ["提交物", "时间节点", "备赛计划"],
      status: "pending", cacheState: "cached", relevance: 0.83,
      excerpt: "提交物、文件格式和截止时间应逐项对照官方通知核对。",
      body: "仅用于展示解析后的条款列表。请上传比赛通知，以原始文件中的实际规定安排计划。",
      highlightedQuotes: [],
      ruleItems: [{ label: "提交要求", text: "提交物、文件格式和截止时间应逐项对照官方通知核对。", page: "示例第 3 条" }],
    },
    {
      id: "case-traceable-ai", kind: "caseStudy",
      title: "可溯源研究助手 · 案例演示",
      source: "产品概念案例 · 非真实获奖作品", sourceMode: "sample",
      occurredAt: "2026-10-29", cachedAt, pageRef: "设计观察",
      tags: ["案例", "证据链", "创新点"],
      status: "pending", cacheState: "cached", relevance: 0.86,
      excerpt: caseText, body: "概念案例用于展示如何记录设计观察。真实往届优秀作品应补充官方作品链接、获奖记录和核验时间。",
      highlightedQuotes: [caseText],
    },
    {
      id: "case-competitor-gap", kind: "caseStudy",
      title: "竞品分析历史观察 · 示例",
      source: "演示观察记录 · 已过时", sourceMode: "sample",
      occurredAt: "2025-10-29", cachedAt, pageRef: "观察条目 07",
      tags: ["竞品", "差异化", "历史版本"],
      status: "deprecated", cacheState: "unavailable", relevance: 0.55,
      excerpt: "早期观察未覆盖竞品的近期功能，应重新调研后再用于市场判断。",
      body: "保留废弃记录用于提醒历史报告复核。废弃证据默认排在末尾，不能用于新的已确认结论。",
      highlightedQuotes: [],
    },
  ],
  reports: [{
    id: "traceability-demo", title: "可溯源竞赛助手 · 技术路线示例",
    createdAt: cachedAt, mode: "sample", sources: [], scoringClauses: [],
    blocks: [
      { id: "route-rag", heading: "技术路线 · 第 1 点", text: "使用检索增强生成组织规则与论文摘要，在输出建议时同时展示检索到的来源。通过自己的对照实验评估事实性和召回效果。" },
      { id: "route-agent", heading: "技术路线 · 第 2 点", text: "将计划、工具调用和结果回写组织成可观察的任务流程。ReAct 提供了推理与动作交替组织的研究参考。" },
      { id: "score", heading: "评分点对应建议 · 第 1 点", text: "演示一次条款检索、建议生成和原文回链。此处引用的是产品示例评分条款，正式参赛需替换为官方文件。" },
      { id: "innovation", heading: "创新点建议", text: "在建议旁展示证据入口，在证据详情中展示报告引用记录，形成双向可回看的证据链。" },
      { id: "plan", heading: "备赛计划", text: "第 1 天核对官方通知和提交要求，第 2 天完成关键链路与演示验收。实际计划应按官方时间和团队能力调整。" },
      { id: "history", heading: "历史竞品观察 · 待复核", text: "早期竞品观察已过时，保留引用用于提醒重新调研，不作为当前市场事实。" },
    ],
  }],
  citations: [
    { id: "demo-rag", evidenceId: "paper-rag-grounding", reportId: "traceability-demo", blockId: "route-rag", verification: "confirmed" },
    { id: "demo-agent", evidenceId: "paper-agent-tool-use", reportId: "traceability-demo", blockId: "route-agent", verification: "pending" },
    { id: "demo-score", evidenceId: "rule-ai-web-score", reportId: "traceability-demo", blockId: "score", verification: "pending" },
    { id: "demo-case", evidenceId: "case-traceable-ai", reportId: "traceability-demo", blockId: "innovation", verification: "pending" },
    { id: "demo-plan", evidenceId: "rule-submission", reportId: "traceability-demo", blockId: "plan", verification: "pending" },
    { id: "demo-history", evidenceId: "case-competitor-gap", reportId: "traceability-demo", blockId: "history", verification: "pending" },
  ],
};

