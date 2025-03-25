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
    const { prompt, model = 'openai', size = '512x512' } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: '缺少提示内容' },
        { status: 400 }
      );
    }

    let imageUrl = '';

    // 根据选择的模型使用不同的AI服务
    if (model === 'openai') {
      const response = await openai.images.generate({
        prompt: prompt,
        n: 1,
        size: size as '256x256' | '512x512' | '1024x1024',
      });

      imageUrl = response.data[0]?.url || '';
    } else if (model === 'huggingface') {
      // 使用HuggingFace的图像生成模型
      const blob = await hf.textToImage({
        model: 'stabilityai/stable-diffusion-2',
        inputs: prompt,
        parameters: {
          negative_prompt: 'blurry, bad quality, weird',
        }
      });
      
      // 将blob转换为Base64字符串
      const buffer = await blob.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      imageUrl = `data:image/jpeg;base64,${base64}`;
    } else {
      return NextResponse.json(
        { error: '不支持的模型类型' },
        { status: 400 }
      );
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: '生成图像失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('图像生成错误:', error);
    return NextResponse.json(
      { error: '生成图像时发生错误' },
      { status: 500 }
    );
  }
} 