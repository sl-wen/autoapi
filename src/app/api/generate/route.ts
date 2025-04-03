import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { HfInference } from '@huggingface/inference';

// Validate environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable');
}

if (!HUGGINGFACE_API_KEY) {
  console.error('Missing HUGGINGFACE_API_KEY environment variable');
}

// Initialize AI clients only if API keys are available
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const hf = HUGGINGFACE_API_KEY ? new HfInference(HUGGINGFACE_API_KEY) : null;

export async function POST(request: NextRequest) {
  try {
    const { prompt, model = 'openai', maxTokens = 500 } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: '缺少提示内容' },
        { status: 400 }
      );
    }

    let generatedText = '';

    // Check for model availability before processing
    if (model === 'openai') {
      if (!openai) {
        return NextResponse.json(
          { error: 'OpenAI服务未配置。请在环境变量中设置OPENAI_API_KEY。' },
          { status: 503 }
        );
      }
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
      });
      generatedText = response.choices[0]?.message.content || '无法生成文本';
    } else if (model === 'huggingface') {
      if (!hf) {
        return NextResponse.json(
          { error: 'HuggingFace服务未配置。请在环境变量中设置HUGGINGFACE_API_KEY。' },
          { status: 503 }
        );
      }
      const result = await hf.textGeneration({
        model: 'gpt2',
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          return_full_text: false
        }
      });
      generatedText = result.generated_text;
    } else {
      return NextResponse.json(
        { error: '不支持的模型类型' },
        { status: 400 }
      );
    }

    return NextResponse.json({ generatedText });
  } catch (error) {
    console.error('文本生成错误:', error);
    const errorMessage = error instanceof Error ? error.message : '生成文本时发生错误';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}