import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen p-12 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-800">AI服务平台</h1>
          <p className="text-xl text-gray-600">强大的AI服务，轻松实现智能自动化</p>
        </header>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700 border-b pb-2">API服务</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 文本生成 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-3 text-indigo-600">文本生成</h3>
              <p className="text-gray-600 mb-4">使用先进的AI模型生成高质量的文本内容，支持多种应用场景。</p>
              <div className="text-sm text-gray-500">
                <p>端点: <code className="bg-gray-100 px-1 rounded">/api/generate</code></p>
                <p>支持: OpenAI, HuggingFace</p>
              </div>
            </div>

            {/* 文章摘要 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-3 text-indigo-600">文章摘要</h3>
              <p className="text-gray-600 mb-4">自动从长文本中提取关键信息，生成简洁准确的摘要。</p>
              <div className="text-sm text-gray-500">
                <p>端点: <code className="bg-gray-100 px-1 rounded">/api/summarize</code></p>
                <p>支持: OpenAI, HuggingFace</p>
              </div>
            </div>

            {/* 图像生成 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-3 text-indigo-600">图像生成</h3>
              <p className="text-gray-600 mb-4">通过文本描述生成高质量图像，支持多种风格和尺寸。</p>
              <div className="text-sm text-gray-500">
                <p>端点: <code className="bg-gray-100 px-1 rounded">/api/image</code></p>
                <p>支持: OpenAI, HuggingFace</p>
              </div>
            </div>

            {/* 自动化任务 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-3 text-indigo-600">自动化任务</h3>
              <p className="text-gray-600 mb-4">创建和管理AI自动化任务，支持定时执行和批量处理。</p>
              <div className="text-sm text-gray-500">
                <p>端点: <code className="bg-gray-100 px-1 rounded">/api/tasks</code></p>
                <p>支持: 任务创建, 列表, 删除</p>
              </div>
            </div>

            {/* 情感分析 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-3 text-indigo-600">情感分析</h3>
              <p className="text-gray-600 mb-4">分析文本情感倾向，帮助理解用户反馈和社交媒体评论。</p>
              <div className="text-sm text-gray-500">
                <p>使用: <code className="bg-gray-100 px-1 rounded">AIService.analyzeSentiment()</code></p>
                <p>支持: OpenAI</p>
              </div>
            </div>

            {/* 关键词提取 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-3 text-indigo-600">关键词提取</h3>
              <p className="text-gray-600 mb-4">从文本中提取关键词和主题，帮助内容分类和SEO优化。</p>
              <div className="text-sm text-gray-500">
                <p>使用: <code className="bg-gray-100 px-1 rounded">AIService.extractKeywords()</code></p>
                <p>支持: OpenAI</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700 border-b pb-2">快速开始</h2>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4 text-indigo-600">调用API</h3>
            <div className="bg-gray-800 text-white p-4 rounded-md overflow-x-auto mb-6">
              <pre className="text-sm">
{`// 使用fetch调用文本生成API
fetch('${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api'}/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: '写一篇关于人工智能的短文',
    model: 'openai',
    maxTokens: 500
  })
})
.then(res => res.json())
.then(data => console.log(data.generatedText));`}
              </pre>
            </div>

            <h3 className="text-xl font-semibold mb-4 text-indigo-600">创建自动化任务</h3>
            <div className="bg-gray-800 text-white p-4 rounded-md overflow-x-auto">
              <pre className="text-sm">
{`// 创建一个定时摘要任务
fetch('${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api'}/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'summarize',
    data: {
      text: '需要摘要的长文本内容...'
    },
    schedule: '0 9 * * *'  // 每天早上9点执行
  })
})
.then(res => res.json())
.then(data => console.log(data.task));`}
              </pre>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700 border-b pb-2">示例应用</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold mb-3 text-indigo-600">智能内容助手</h3>
              <p className="text-gray-600 mb-4">自动生成文章、摘要和SEO建议的内容创作辅助工具。</p>
              <Link href="/demo/content-assistant" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded transition-colors">
                查看演示
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold mb-3 text-indigo-600">AI图像工作室</h3>
              <p className="text-gray-600 mb-4">通过文本描述生成和编辑图像的创意设计工具。</p>
              <Link href="/demo/image-studio" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded transition-colors">
                查看演示
              </Link>
            </div>
          </div>
        </section>

        <footer className="text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} AI服务平台. 保留所有权利.</p>
          <p className="mt-2">使用前请确保您已在.env.local文件中配置有效的API密钥。</p>
        </footer>
      </div>
    </main>
  );
} 