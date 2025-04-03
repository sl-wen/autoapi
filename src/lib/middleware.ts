import { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';

// 允许的源列表
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002'
];

export async function cors(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // 获取请求头中的来源
  const origin = req.headers.origin || '';
  
  // 设置CORS头
  res.setHeader(
    'Access-Control-Allow-Origin', 
    allowedOrigins.includes(origin) ? origin : '*'
  );
  
  // 允许凭证（如cookies）
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // 允许的方法
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  
  // 允许的请求头
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
}

export function getLocale(request: NextRequest): string {
  // Get locale from Accept-Language header or query parameter
  const acceptLang = request.headers.get('Accept-Language') || '';
  const queryLang = request.nextUrl.searchParams.get('lang');
  
  // Check if Japanese is preferred
  if (queryLang === 'ja' || acceptLang.startsWith('ja')) {
    return 'ja';
  }
  
  // Default to Chinese
  return 'zh';
}

export function withLocale(handler: Function) {
  return async (request: NextRequest) => {
    const locale = getLocale(request);
    // Add locale to request context
    (request as any).locale = locale;
    return handler(request);
  };
}