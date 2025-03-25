import { NextRequest, NextResponse } from 'next/server';
import { HuggingFaceService, Language } from '@/lib/huggingface';

export async function POST(request: NextRequest) {
  try {
    const { text, sourceLanguage = 'auto', targetLanguage = 'zh', model = 'huggingface' } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: '缺少文本内容' },
        { status: 400 }
      );
    }

    // 目前仅支持HuggingFace
    if (model !== 'huggingface') {
      return NextResponse.json(
        { error: '不支持的模型类型' },
        { status: 400 }
      );
    }

    // 初始化HuggingFace服务
    const hfService = HuggingFaceService.getInstance();
    
    try {
      // 翻译文本
      const result = await hfService.translate(
        text,
        sourceLanguage as Language,
        targetLanguage as Language
      );

      return NextResponse.json({ 
        translatedText: result.translation_text,
        sourceLanguage,
        targetLanguage
      });
    } catch (translationError: any) {
      console.error('翻译错误详情:', translationError);
      
      // 尝试使用备用翻译模型
      try {
        // 使用HuggingFace客户端直接调用模型，不使用参数
        const hfClient = hfService.getClient();
        const fallbackResult = await hfClient.translation({
          model: 'Helsinki-NLP/opus-mt-en-zh', // 使用可靠的模型
          inputs: text
        });
        
        return NextResponse.json({ 
          translatedText: fallbackResult.translation_text,
          sourceLanguage,
          targetLanguage,
          note: '使用了备用翻译模型'
        });
      } catch (fallbackError: any) {
        throw new Error(`翻译失败: ${translationError.message}. 备用模型也失败: ${fallbackError.message}`);
      }
    }
  } catch (error: any) {
    console.error('翻译错误:', error);
    return NextResponse.json(
      { error: `翻译时发生错误: ${error.message}` },
      { status: 500 }
    );
  }
} 