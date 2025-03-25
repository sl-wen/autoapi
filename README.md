# AI服务：文本摘要和翻译应用

这是一个基于Next.js构建的AI文本处理应用，提供文章摘要和多语言翻译功能。本项目使用了OpenAI和Hugging Face的模型来提供高质量的文本处理服务。

## 功能特性

- **文章摘要**：自动生成文章摘要，支持中英文
- **多语言翻译**：支持多种语言之间的互译，优化中英文翻译效果
- **批量处理**：同时处理多篇文章的摘要和翻译
- **自适应模型选择**：根据内容语言自动选择最合适的模型
- **错误处理与回退机制**：在主要模型失败时自动切换到备用模型

## 技术栈

- **前端**：HTML/CSS/JavaScript
- **后端**：Next.js API Routes
- **AI模型**：
  - OpenAI GPT 模型
  - Hugging Face多种模型（T5、BART、MT5、M2M100等）

## 部署到Vercel

### 前提条件

1. 拥有[Vercel](https://vercel.com)账号
2. 拥有[Hugging Face](https://huggingface.co)账号并创建API令牌
3. 可选：拥有[OpenAI](https://platform.openai.com)账号和API密钥

### 部署步骤

1. **Fork或Clone本仓库**

2. **连接到Vercel**
   - 登录Vercel并创建新项目
   - 导入你的GitHub仓库
   - 系统会自动检测为Next.js项目

3. **设置环境变量**
   在Vercel项目设置中，添加以下环境变量：
   ```
   HUGGINGFACE_API_KEY=你的HuggingFace API密钥
   OPENAI_API_KEY=你的OpenAI API密钥（可选）
   ```

4. **部署**
   - 点击"Deploy"按钮
   - 等待部署完成
   - 访问生成的URL，例如`https://your-project.vercel.app`

5. **测试应用**
   - 访问`https://your-project.vercel.app/test.html`使用Web界面
   - 或直接调用API：`https://your-project.vercel.app/api/summarize`或`/api/translate`

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm run start
```

## 环境变量

创建`.env.local`文件并设置以下变量：

```
HUGGINGFACE_API_KEY=你的HuggingFace API密钥
OPENAI_API_KEY=你的OpenAI API密钥（可选，但推荐）
```

## API参考

### 摘要API

```
POST /api/summarize
{
  "text": "要摘要的文本内容",
  "model": "openai或huggingface:模型名称",
  "language": "zh或en",
  "maxLength": 150
}
```

### 翻译API

```
POST /api/translate
{
  "text": "要翻译的文本内容",
  "sourceLanguage": "源语言代码",
  "targetLanguage": "目标语言代码"
}
```

支持的语言代码：`en`, `zh`, `fr`, `de`, `es`, `ru`, `ja`, `ko`，以及`auto`（自动检测）

## 许可证

MIT