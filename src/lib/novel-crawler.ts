import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

export interface NovelChapter {
  title: string;
  content: string;
  url: string;
  index?: number;
}

export interface NovelCrawlerOptions {
  concurrentLimit?: number;
  chunkSize?: number;
}

export class NovelCrawler {
  private baseUrl: string;
  private novelName: string;
  private concurrentLimit: number;
  private chunkSize: number;
  private userAgents: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
  ];

  constructor(baseUrl: string, novelName: string, options?: NovelCrawlerOptions) {
    this.baseUrl = this.normalizeUrl(baseUrl.trim());
    this.novelName = novelName.trim();
    this.concurrentLimit = options?.concurrentLimit || 5;
    this.chunkSize = options?.chunkSize || 20;
  }

  private normalizeUrl(url: string): string {
    url = url.replace(/\/$/, '');
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    // 对xs5200特定处理
    if (url.includes('xs5200.net') && !url.includes('.html')) {
      // 确保URL格式正确，例如：https://www.xs5200.net/44_44108/
      const match = url.match(/(\d+)_(\d+)/);
      if (match) {
        const prefix = match[1];
        const novelId = match[2];
        url = `https://www.xs5200.net/${prefix}_${novelId}/`;
      }
    }
    
    return url;
  }

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async fetchPage(url: string, retryCount = 0): Promise<string> {
    try {
      console.log(`正在获取页面: ${url}`);
      
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
      
      const host = new URL(url).host;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': url,
          'Connection': 'keep-alive',
          'Host': host,
          'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Cookie': 'jieqiVisitId=article_articleviews%3D44108'
        },
        timeout: 10000,
        httpsAgent,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 300 || status === 404;
        },
        responseType: 'text',
        transformResponse: [(data) => {
          // 如果响应是HTML，直接返回
          if (typeof data === 'string' && data.trim().startsWith('<!DOCTYPE')) {
            return data;
          }
          // 如果响应是JSON，尝试解析
          try {
            return JSON.parse(data);
          } catch {
            // 如果解析失败，返回原始数据
            return data;
          }
        }]
      });

      // 检查重定向
      if (response.data && typeof response.data === 'string') {
        const html = response.data;
        
        // 检查页面是否包含重定向
        if (html.includes('http-equiv="refresh"') || html.includes('window.location.href=')) {
          console.log(`检测到重定向页面`);
          
          // 尝试提取重定向URL
          const refreshMatch = html.match(/content="[^"]*url=([^"]+)"/i);
          const locationMatch = html.match(/window\.location\.href=['"]([^'"]+)['"]/i);
          
          const redirectUrl = refreshMatch?.[1] || locationMatch?.[1];
          
          if (redirectUrl) {
            console.log(`找到重定向URL: ${redirectUrl}`);
            
            // 检查是否是小说ID重定向
            if (redirectUrl.includes('xs5200.net')) {
              // 直接获取小说基础信息页面
              console.log(`尝试获取分类页面以查找小说`);
              
              // 如果URL已经包含小说ID，尝试直接构建正确的URL
              const novelMatch = url.match(/(\d+)_(\d+)/);
              if (novelMatch) {
                const prefix = novelMatch[1];
                const novelId = novelMatch[2];
                
                // 尝试多种可能的URL格式
                const possibleUrls = [
                  `https://www.xs5200.net/${prefix}_${novelId}/`,
                  `http://www.xs5200.net/${prefix}_${novelId}/`,
                  `https://m.xs5200.net/${prefix}_${novelId}/`,
                  `http://m.xs5200.net/${prefix}_${novelId}/`
                ];
                
                for (const possibleUrl of possibleUrls) {
                  try {
                    console.log(`尝试特定格式URL: ${possibleUrl}`);
                    return await this.fetchPage(possibleUrl, retryCount + 1);
                  } catch {
                    console.log(`尝试特定格式URL失败: ${possibleUrl}`);
                  }
                }
              }
              
              // 如果直接构建URL失败，则尝试获取重定向URL
              if (retryCount < 2) {
                console.log(`获取重定向URL: ${redirectUrl}`);
                return await this.fetchPage(redirectUrl, retryCount + 1);
              }
            }
          }
        }
      }

      // 如果是404，尝试其他可能的URL格式
      if (response.status === 404 && retryCount < 3) {
        console.log(`状态码404，尝试其他URL格式`);
        
        // 针对这个具体网站的特殊处理
        if (url.includes('xs5200.net')) {
          // 尝试提取小说ID
          const novelMatch = url.match(/(\d+)_(\d+)/);
          if (novelMatch) {
            const prefix = novelMatch[1];
            const novelId = novelMatch[2];
            
            // 针对xs5200的特殊处理
            const alternativeUrls = [
              `http://www.xs5200.net/${prefix}_${novelId}/`,
              `https://xs5200.net/${prefix}_${novelId}/`,
              `http://xs5200.net/${prefix}_${novelId}/`,
              `http://m.xs5200.net/${prefix}_${novelId}/`,
              `https://m.xs5200.net/${prefix}_${novelId}/`
            ];
            
            for (const altUrl of alternativeUrls) {
              try {
                console.log(`尝试备选URL: ${altUrl}`);
                const altResponse = await this.fetchPage(altUrl, retryCount + 1);
                if (altResponse) return altResponse;
              } catch {
                console.log(`尝试备选URL失败: ${altUrl}`);
              }
            }
          }
        } else {
          // 通用备选URL处理
          const alternativeUrls = [
            url.replace(/\/$/, ''),
            url.replace(/www\./, ''),
            url.replace(/https:\/\//, 'http://'),
            url.replace(/\.com/, '.net'),
            url.replace(/\.net/, '.com'),
            url.replace(/^https?:\/\//, 'https://m.'),
            url.replace(/^https?:\/\//, 'http://m.')
          ];

          for (const altUrl of alternativeUrls) {
            try {
              console.log(`尝试备选URL: ${altUrl}`);
              const altResponse = await this.fetchPage(altUrl, retryCount + 1);
              if (altResponse) return altResponse;
            } catch {
              console.log(`尝试备选URL失败: ${altUrl}`);
            }
          }
        }
      }

      // 检查响应内容是否包含有效的HTML
      if (response.data && typeof response.data === 'string') {
        const html = response.data.trim();
        
        // 检查是否是有效的HTML
        if (html.startsWith('<!DOCTYPE') || html.startsWith('<html')) {
          // 检查是否包含验证码或反爬提示
          if (html.includes('验证码') || 
              html.includes('访问太频繁') || 
              html.includes('请输入验证码') ||
              html.includes('访问受限')) {
            throw new Error('遇到验证码或访问限制，请稍后重试');
          }
          
          // 检查是否是错误页面
          if (html.includes('404') && html.includes('页面不存在')) {
            throw new Error('页面不存在，请检查URL是否正确');
          }
          
          return html;
        } else {
          throw new Error('响应内容不是有效的HTML');
        }
      } else {
        throw new Error('响应内容格式错误');
      }
    } catch (error) {
      console.error(`获取页面失败: ${url}`, error);
      
      // 处理特定错误
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`连接被拒绝，网站可能已关闭或更换域名`);
        }
        if (error.response?.status === 403) {
          throw new Error(`访问被禁止，可能需要等待一段时间后重试`);
        }
        if (error.response?.status === 404) {
          throw new Error(`页面不存在，请检查URL是否正确`);
        }
        if (error.code === 'ETIMEDOUT') {
          throw new Error(`请求超时，请检查网络连接或稍后重试`);
        }
        if (error.code === 'ECONNRESET') {
          throw new Error(`连接被重置，可能需要使用代理`);
        }
      }

      // 如果是最后一次重试，抛出详细错误
      if (retryCount >= 3) {
        throw new Error(`无法访问网站，请检查URL是否正确或网站是否可访问`);
      }

      // 递增重试延迟
      const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
      console.log(`等待 ${delay}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 递归重试
      return this.fetchPage(url, retryCount + 1);
    }
  }

  private async getChapterLinks(): Promise<string[]> {
    try {
      const html = await this.fetchPage(this.baseUrl);
      const $ = cheerio.load(html);
      
      console.log('开始提取章节链接...');
      
      // 针对xs5200网站的特定选择器
      const links = new Set<string>();
      
      // 首先尝试目录列表
      const listSelectors = [
        '#list dd a',
        '.listmain dd a',
        '#chapterlist dd a',
        '#chapter-list dd a',
        '.novel_list dd a',
        '.chapter-list dd a',
        '.article-list dd a',
        '#xslist dd a'
      ];

      // 遍历所有可能的选择器
      for (const selector of listSelectors) {
        $(selector).each((_, element) => {
          const href = $(element).attr('href');
          const text = $(element).text().trim();
          
          if (href && text) {
            try {
              const fullUrl = href.startsWith('http') ? href : new URL(href, this.baseUrl).toString();
              links.add(fullUrl);
            } catch (error) {
              console.error(`无法解析URL: ${href}`, error);
            }
          }
        });

        if (links.size > 0) {
          console.log(`使用选择器 ${selector} 找到 ${links.size} 个链接`);
          break;
        }
      }
      
      // 如果没有找到，尝试其他通用选择器
      if (links.size === 0) {
        // 查找所有可能的章节容器
        const containerSelectors = [
          '#list',
          '.listmain',
          '#chapterlist',
          '#chapter-list',
          '.novel_list',
          '.chapter-list',
          '.article-list',
          '#xslist'
        ];

        for (const containerSelector of containerSelectors) {
          const container = $(containerSelector);
          if (container.length > 0) {
            console.log(`找到容器: ${containerSelector}`);
            container.find('a').each((_, element) => {
              const href = $(element).attr('href');
              const text = $(element).text().trim();
              
              if (href && text && (
                text.includes('章') || 
                text.includes('卷') || 
                text.match(/^\s*第.+[章节卷篇]\s*$/) ||
                text.match(/^\d+\s*[\.、]/) ||
                /^\d+$/.test(text)  // 纯数字
              )) {
                try {
                  const fullUrl = href.startsWith('http') ? href : new URL(href, this.baseUrl).toString();
                  links.add(fullUrl);
                } catch (error) {
                  console.error(`无法解析URL: ${href}`, error);
                }
              }
            });
          }

          if (links.size > 0) {
            console.log(`从容器 ${containerSelector} 找到 ${links.size} 个链接`);
            break;
          }
        }
      }

      // 如果还是没有找到，尝试全站扫描
      if (links.size === 0) {
        console.log('尝试全站扫描...');
        $('a').each((_, element) => {
          const href = $(element).attr('href');
          const text = $(element).text().trim();
          
          if (href && text && (
            text.includes('章') || 
            text.includes('卷') || 
            text.match(/^\s*第.+[章节卷篇]\s*$/) ||
            text.match(/^\d+\s*[\.、]/) ||
            /^\d+$/.test(text) ||  // 纯数字
            href.includes('chapter') ||
            href.match(/\/\d+\.html?$/)  // 以数字.html结尾的URL
          )) {
            try {
              const fullUrl = href.startsWith('http') ? href : new URL(href, this.baseUrl).toString();
              // 确保链接属于同一网站
              if (fullUrl.startsWith(this.baseUrl)) {
                links.add(fullUrl);
              }
            } catch (error) {
              console.error(`无法解析URL: ${href}`, error);
            }
          }
        });
        
        console.log(`全站扫描找到 ${links.size} 个链接`);
      }
      
      // 将链接转换为数组并排序
      const sortedLinks = Array.from(links).sort((a, b) => {
        const aMatch = a.match(/\d+/);
        const bMatch = b.match(/\d+/);
        if (aMatch && bMatch) {
          return parseInt(aMatch[0]) - parseInt(bMatch[0]);
        }
        return a.localeCompare(b);
      });

      if (sortedLinks.length === 0) {
        // 尝试直接匹配目录页结构
        console.log('尝试直接分析网页结构...');
        
        // 尝试查找常见的小说目录标记
        const possibleContentMarkers = [
          'content="小说,',
          'name="keywords" content',
          'class="mulu"',
          'class="catalog"',
          'class="directory"',
          'id="chapters"',
          'id="chapterlist"'
        ];
        
        let foundContentMarker = false;
        for (const marker of possibleContentMarkers) {
          if (html.includes(marker)) {
            console.log(`找到内容标记: ${marker}`);
            foundContentMarker = true;
          }
        }
        
        if (!foundContentMarker) {
          console.log('页面内容片段:', html.substring(0, 500));
          
          // 检查是否需要处理特殊字符编码
          const encodedLinks = new Set<string>();
          $('a[href]').each((_, element) => {
            const href = $(element).attr('href');
            if (href && href.includes('/44_44108/')) {
              try {
                const fullUrl = href.startsWith('http') ? href : new URL(href, this.baseUrl).toString();
                encodedLinks.add(fullUrl);
              } catch (error) {
                console.error(`无法解析URL: ${href}`, error);
              }
            }
          });
          
          if (encodedLinks.size > 0) {
            console.log(`找到包含小说ID的链接: ${encodedLinks.size} 个`);
            return Array.from(encodedLinks);
          }
          
          throw new Error('无法分析网站结构，未找到任何章节链接');
        }
        
        throw new Error('未找到任何章节链接，请检查网站结构或URL是否正确');
      }

      console.log(`找到 ${sortedLinks.length} 个章节链接`);
      console.log('第一章链接:', sortedLinks[0]);
      console.log('最后一章链接:', sortedLinks[sortedLinks.length - 1]);

      return sortedLinks;
    } catch (error) {
      console.error('获取章节列表失败:', error);
      if (error instanceof Error) {
        throw new Error(`获取章节列表失败: ${error.message}`);
      }
      throw new Error('获取章节列表失败: 未知错误');
    }
  }

  private async getChapterContent(url: string): Promise<NovelChapter> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);
      
      // 尝试多个可能的标题选择器
      const titleSelectors = [
        'h1',
        '.chapter-title',
        '.article-title',
        '#chapter-title',
        '.title'
      ];
      
      let title = '';
      for (const selector of titleSelectors) {
        title = $(selector).first().text().trim();
        if (title) break;
      }
      
      if (!title) {
        title = '未命名章节';
      }
      
      // 尝试多个可能的内容选择器
      const contentSelectors = [
        '#content',
        '.chapter-content',
        '.article-content',
        '.content',
        '#chapter-content',
        '.read-content',
        '.article'
      ];
      
      let content = '';
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim()
            .replace(/\s+/g, '\n')  // 规范化空白字符
            .replace(/[""]/g, '"')  // 统一引号
            .replace(/['']/g, "'")  // 统一引号
            .replace(/\n+/g, '\n\n')  // 规范化段落
            .replace(/^.*?最新章节.*?\n/g, '')  // 移除广告文本
            .replace(/本章未完.*?下一页/g, '')  // 移除分页提示
            .replace(/（记住.*?下次阅读）/g, '')  // 移除网站提示
            .replace(/手机用户请访问.*$/g, '');  // 移除底部广告
          break;
        }
      }
      
      if (!content) {
        throw new Error('无法提取章节内容');
      }
      
      return {
        title,
        content,
        url
      };
    } catch (error) {
      console.error(`获取章节内容失败: ${url}`, error);
      if (error instanceof Error) {
        throw new Error(`获取章节内容失败: ${error.message}`);
      }
      throw new Error(`获取章节内容失败: 未知错误`);
    }
  }

  public async crawl(): Promise<{ content: string; filename: string }> {
    try {
      console.log(`开始爬取小说: ${this.novelName}`);
      
      // 获取所有章节链接
      const links = await this.getChapterLinks();
      console.log(`找到 ${links.length} 个章节`);
      
      if (links.length === 0) {
        throw new Error('未找到任何章节链接');
      }
      
      // 存储所有章节内容
      const chapters: NovelChapter[] = [];
      let failedChapters = 0;
      
      // 并发爬取控制
      const concurrentLimit = this.concurrentLimit;
      const chunkSize = this.chunkSize;
      
      // 按批次处理，每批并发执行
      for (let i = 0; i < links.length; i += chunkSize) {
        const chunk = links.slice(i, i + chunkSize);
        console.log(`处理批次 ${Math.floor(i / chunkSize) + 1}/${Math.ceil(links.length / chunkSize)}, 章节 ${i + 1} 到 ${Math.min(i + chunkSize, links.length)}`);
        
        // 创建任务池
        const tasks = chunk.map((url, index) => {
          return async () => {
            const chapterIndex = i + index;
            console.log(`正在爬取章节 ${chapterIndex + 1}/${links.length}: ${url}`);
            
            try {
              const chapter = await this.getChapterContent(url);
              // 保存章节索引用于后续排序
              return { ...chapter, index: chapterIndex };
            } catch (error) {
              console.error(`章节 ${chapterIndex + 1} 爬取失败:`, error);
              return null;
            }
          };
        });
        
        // 限制并发数的执行器
        const executeTasks = async (tasks: (() => Promise<NovelChapter | null>)[]) => {
          const results: (NovelChapter | null)[] = [];
          
          // 创建任务执行器
          const taskExecutor = async (task: () => Promise<NovelChapter | null>) => {
            const result = await task();
            return result;
          };
          
          // 按并发数分批执行
          for (let j = 0; j < tasks.length; j += concurrentLimit) {
            const currentTasks = tasks.slice(j, j + concurrentLimit);
            const batchResults = await Promise.all(currentTasks.map(task => taskExecutor(task)));
            
            results.push(...batchResults);
            
            // 随机延迟，防止被反爬
            const delay = Math.random() * 1000 + 500; // 0.5-1.5秒随机延迟
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          return results;
        };
        
        // 执行当前批次的任务
        const chunkResults = await executeTasks(tasks);
        
        // 处理结果
        const validChapters = chunkResults.filter(c => c !== null) as NovelChapter[];
        const failedCount = chunkResults.filter(c => c === null).length;
        
        chapters.push(...validChapters);
        failedChapters += failedCount;
        
        // 如果连续失败次数过多，终止爬取
        if (failedChapters > links.length * 0.2) { // 允许最多20%的章节失败
          throw new Error('失败章节数过多，请检查网站是否有反爬虫机制');
        }
      }
      
      // 按原始顺序排序章节
      chapters.sort((a, b) => (a.index || 0) - (b.index || 0));
      
      if (chapters.length === 0) {
        throw new Error('未能成功爬取任何章节');
      }
      
      // 生成文件内容
      const content = chapters
        .map(chapter => `${chapter.title}\n\n${chapter.content}\n\n`)
        .join('\n' + '='.repeat(50) + '\n\n');
      
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.novelName}_${timestamp}.txt`;
      
      console.log(`爬取完成，共 ${chapters.length} 章，失败 ${failedChapters} 章`);
      
      // 返回内容和文件名
      return {
        content,
        filename
      };
    } catch (error) {
      console.error('爬取失败:', error);
      if (error instanceof Error) {
        throw new Error(`爬取失败: ${error.message}`);
      }
      throw new Error('爬取失败: 未知错误');
    }
  }

  public async checkUrl(): Promise<{ chapterCount?: number; novelName?: string; debug?: string }> {
    try {
      console.log(`检查URL: ${this.baseUrl}`);
      
      // 获取页面内容
      const html = await this.fetchPage(this.baseUrl);
      
      // 提取小说标题
      let novelName = '';
      const $ = cheerio.load(html);
      
      // 尝试获取网页标题
      const pageTitle = $('title').text().trim();
      console.log(`页面标题: ${pageTitle}`);
      
      if (pageTitle && !pageTitle.includes('5200小说网')) {
        // 清理标题中的网站信息
        novelName = pageTitle
          .replace(/_.*$/, '')  // 移除下划线后的内容
          .replace(/最新章节.*$/, '')  // 移除"最新章节"及后面的内容
          .replace(/小说$/, '')  // 移除结尾的"小说"
          .replace(/全文阅读$/, '')  // 移除结尾的"全文阅读"
          .replace(/无弹窗$/, '')  // 移除结尾的"无弹窗"
          .trim();
      }
      
      // 尝试获取小说信息
      const h1Text = $('h1').text().trim();
      if (h1Text && (h1Text.length < 30)) {
        novelName = h1Text;
      }
      
      // 尝试获取小说元数据
      const metaDescription = $('meta[name="description"]').attr('content');
      if (metaDescription && !novelName) {
        const descMatch = metaDescription.match(/《([^》]+)》/);
        if (descMatch && descMatch[1]) {
          novelName = descMatch[1].trim();
        }
      }
      
      // 尝试获取章节链接
      try {
        const links = await this.getChapterLinks();
        return {
          chapterCount: links.length,
          novelName: novelName || undefined,
          debug: `找到${links.length}个章节链接，第一个链接: ${links[0]}`
        };
      } catch (error) {
        console.error('获取章节链接失败:', error);
        
        // 如果无法获取章节链接但能获取页面，返回小说名
        if (novelName) {
          return {
            novelName,
            debug: `无法获取章节链接，但找到小说名称: ${novelName}。错误: ${error instanceof Error ? error.message : '未知错误'}`
          };
        }
        
        throw error;
      }
    } catch (error) {
      console.error('URL检查失败:', error);
      throw new Error(`URL检查失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}