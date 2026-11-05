import type { CompetitionId } from "./types";

export type CompetitionDownload = {
  url: string;
  fileName: string;
  sourceLabel: string;
  year: string;
};

/**
 * Official competition requirement sources. Keeping this allow-list in the
 * feature module means the download endpoint can never proxy an arbitrary URL
 * supplied by a browser request.
 */
const downloads: Record<string, CompetitionDownload> = {
  "lanqiao-cup": {
    url: "https://x-static.lanqiao.cn/upload/202610/courseimg/ff81e242-119a-4f2e-95ff-bdb7b5304169.pdf",
    fileName: "第十八届蓝桥杯全国大学生软件和信息技术大赛通知.pdf",
    sourceLabel: "蓝桥杯大赛组委会",
    year: "2026",
  },
  "computer-design": {
    // The 2026 organizer page publishes the current submission package via
    // Baidu Pan. Downloading the official requirements page preserves the
    // current rules without pretending the third-party package is a direct PDF.
    url: "https://jsjds.blcu.edu.cn/info/1045/2013.htm",
    fileName: "中国大学生计算机设计大赛-2026参赛作品提交要求.html",
    sourceLabel: "中国大学生计算机设计大赛组委会",
    year: "2026",
  },
  "math-modeling": {
    url: "https://www.mcm.edu.cn/upload_cn/node/774/FlQt6kJV6f5d5b4603e06c3c60acf89b72d7f298.pdf",
    fileName: "全国大学生数学建模竞赛参赛规则-2026年修订稿.pdf",
    sourceLabel: "全国大学生数学建模竞赛组委会",
    year: "2026",
  },
  "innovation-entrepreneurship": {
    url: "https://t3.chei.com.cn/ncss/cy/web/lib/dasaitongzhi-2026.zip",
    fileName: "中国国际大学生创新大赛-2026赛事通知.zip",
    sourceLabel: "全国大学生创业服务网",
    year: "2026",
  },
  "electronic-design": {
    // The PDF host uses hotlink protection. The official notice page is the
    // stable, directly accessible source and contains the same 2026 notice and
    // its official attachment links.
    url: "https://www.nuedc-training.com.cn/index/news/details/new_id/343",
    fileName: "全国大学生电子设计竞赛-2026专题赛通知.html",
    sourceLabel: "全国大学生电子设计竞赛组委会",
    year: "2026",
  },
  "internet-plus": {
    url: "https://t3.chei.com.cn/ncss/cy/web/lib/dasaitongzhi-2026.zip",
    fileName: "中国国际大学生创新大赛-2026赛事通知.zip",
    sourceLabel: "全国大学生创业服务网",
    year: "2026",
  },
};

export function getCompetitionDownload(id: CompetitionId | string) {
  return downloads[id] ?? null;
}
