import { NextApiRequest, NextApiResponse } from 'next';
import { NovelCrawler } from '@/lib/novel-crawler';
import { cors } from '@/lib/middleware';

// Set timeout to 2 minutes and increase payload limit
export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await cors(req, res);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, novelName } = req.body;

    if (!url) {
      return res.status(400).json({ error: '缺少URL参数' });
    }

    const crawler = new NovelCrawler(url, novelName);
    const result = await crawler.crawl();

    return res.status(200).json({ 
      success: true,
      content: result.content,
      filename: result.filename,
      downloadPath: `/downloads/${result.filename}`
    });

  } catch (error) {
    console.error('爬虫错误:', error);

    const locale = req.headers['accept-language']?.startsWith('ja') ? 'ja' : 'zh';
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    return res.status(500).json({ 
      success: false,
      error: errorMessage,
      locale
    });
  }
}