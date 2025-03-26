import type { NextApiRequest, NextApiResponse } from 'next';
import { NovelCrawler } from '@/lib/novel-crawler';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持POST请求' });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: '缺少URL参数' });
    }

    // 创建临时小说名，仅用于检查URL
    const checker = new NovelCrawler(url, "临时检查");
    const checkResult = await checker.checkUrl();

    res.status(200).json({ 
      success: true, 
      ...checkResult 
    });
  } catch (error) {
    console.error('URL检查错误:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: '未知错误' });
    }
  }
} 