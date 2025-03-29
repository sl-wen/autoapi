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
    const { url, novelName } = req.body;

    if (!url || !novelName) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const crawler = new NovelCrawler(url, novelName);
    const result = await crawler.crawl();

    res.status(200).json({ 
      success: true,
      content: result.content,
      filename: result.filename
    });
  } catch (error) {
    console.error('爬虫错误:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: '未知错误' });
    }
  }
} 