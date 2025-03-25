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

    // 确保语言代码正确
    const validLanguages = ['auto', 'en', 'zh', 'fr', 'de', 'es', 'ru', 'ja', 'ko'];
    const validSourceLang = validLanguages.includes(sourceLanguage as string) ? sourceLanguage as Language : 'auto';
    const validTargetLang = validLanguages.includes(targetLanguage as string) ? targetLanguage as Language : 'zh';

    console.log(`翻译请求: 从 ${validSourceLang} 到 ${validTargetLang}`);

    // 初始化HuggingFace服务
    const hfService = HuggingFaceService.getInstance();
    
    try {
      // 翻译文本
      const result = await hfService.translate(
        text,
        validSourceLang,
        validTargetLang
      );

      return NextResponse.json({ 
        translatedText: result.translation_text,
        sourceLanguage: validSourceLang,
        targetLanguage: validTargetLang
      });
    } catch (translationError: any) {
      console.error('翻译错误详情:', translationError);
      
      // 尝试使用备用翻译模型
      try {
        // 使用HuggingFace客户端直接调用模型，不使用参数
        const hfClient = hfService.getClient();
        
        // 根据目标语言选择合适的模型
        const fallbackModel = validTargetLang === 'zh' ? 'Helsinki-NLP/opus-mt-en-zh' :
                              validTargetLang === 'en' ? 'Helsinki-NLP/opus-mt-zh-en' :
                              'facebook/m2m100_418M';
        
        // 使用request方法避免类型检查错误
        const fallbackResult = await hfClient.request({
          model: fallbackModel,
          inputs: text,
          task: "translation"
        });
        
        // 解析结果
        let translatedText = '';
        if (typeof fallbackResult === 'string') {
          translatedText = fallbackResult;
        } else if (Array.isArray(fallbackResult) && fallbackResult.length > 0) {
          if (typeof fallbackResult[0] === 'string') {
            translatedText = fallbackResult[0];
          } else if (fallbackResult[0] && (fallbackResult[0] as any).translation_text) {
            translatedText = (fallbackResult[0] as any).translation_text;
          } else if (fallbackResult[0] && (fallbackResult[0] as any).generated_text) {
            translatedText = (fallbackResult[0] as any).generated_text;
          } else {
            translatedText = JSON.stringify(fallbackResult[0]);
          }
        } else {
          translatedText = JSON.stringify(fallbackResult);
        }
        
        return NextResponse.json({ 
          translatedText,
          sourceLanguage: validSourceLang,
          targetLanguage: validTargetLang,
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