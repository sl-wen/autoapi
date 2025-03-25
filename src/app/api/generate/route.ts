import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { HfInference } from '@huggingface/inference';

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 初始化HuggingFace客户端
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

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

    // 根据选择的模型使用不同的AI服务
    if (model === 'openai') {
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
      // 使用HuggingFace的文本生成模型
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
    return NextResponse.json(
      { error: '生成文本时发生错误' },
      { status: 500 }
    );
  }
} 