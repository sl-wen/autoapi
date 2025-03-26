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
    const { url, novelName, concurrentLimit, chunkSize } = req.body;

    if (!url || !novelName) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 验证并发参数
    const concurrentLimitNum = Number(concurrentLimit) || 5;
    const chunkSizeNum = Number(chunkSize) || 20;

    // 限制参数范围
    const validConcurrentLimit = Math.min(Math.max(1, concurrentLimitNum), 10);
    const validChunkSize = Math.min(Math.max(10, chunkSizeNum), 100);

    console.log(`爬取配置: 并发数=${validConcurrentLimit}, 批次大小=${validChunkSize}`);

    const crawler = new NovelCrawler(url, novelName, {
      concurrentLimit: validConcurrentLimit,
      chunkSize: validChunkSize
    });
    
    const result = await crawler.crawl();

    res.status(200).json({ success: true, downloadPath: result });
  } catch (error) {
    console.error('爬虫错误:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: '未知错误' });
    }
  }
} 