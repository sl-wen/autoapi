import { NextRequest, NextResponse } from 'next/server';
import { HuggingFaceService, Language } from '@/lib/huggingface';

// 定义错误类型接口
interface ApiError extends Error {
  code?: string;
  status?: number;
}

// 定义处理结果类型
interface ProcessResult {
  originalText: string;
  summary?: string;
  translatedText?: string;
  translatedSummary?: string;
  error?: string;
}

// 定义翻译结果类型
interface TranslationResult {
  translation_text: string;
}

// 定义请求参数类型
interface BatchProcessRequest {
  articles: string[];
  task?: 'summarize' | 'translate' | 'both';
  sourceLanguage?: string;
  targetLanguage?: string;
  summaryModel?: string;
  maxLength?: number;
}

// 验证语言类型
function isValidLanguage(lang: string): lang is Language {
  const validLanguages: Language[] = ['auto', 'en', 'zh', 'fr', 'de', 'es', 'ru', 'ja', 'ko'];
  return validLanguages.includes(lang as Language);
}

export async function POST(request: NextRequest) {
  try {
    const { 
      articles, 
      task = 'summarize', 
      sourceLanguage: srcLang = 'auto', 
      targetLanguage: tgtLang = 'zh',
      summaryModel = 'mt5',
      maxLength = 150 
    }: BatchProcessRequest = await request.json();

    // 验证语言参数
    if (!isValidLanguage(srcLang) || !isValidLanguage(tgtLang)) {
      return NextResponse.json(
        { error: '不支持的语言类型' },
        { status: 400 }
      );
    }

    const sourceLanguage = srcLang as Language;
    const targetLanguage = tgtLang as Language;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { error: '缺少有效的文章内容' },
        { status: 400 }
      );
    }

    // 验证任务类型
    const validTasks = ['summarize', 'translate', 'both'];
    if (!validTasks.includes(task)) {
      return NextResponse.json(
        { error: '无效的任务类型' },
        { status: 400 }
      );
    }

    // 初始化HuggingFace服务
    const hfService = HuggingFaceService.getInstance();
    const hfClient = hfService.getClient();

    const results: ProcessResult[] = [];
    const errors: string[] = [];

    // 逐个处理文章
    for (const [index, article] of articles.entries()) {
      try {
        const result: ProcessResult = {
          originalText: article
        };

        // 根据任务类型进行处理
        if (task === 'summarize' || task === 'both') {
          try {
            // 生成摘要
            const summaryResult = await hfService.summarize(
              article,
              summaryModel,
              maxLength,
              Math.min(30, maxLength / 3)
            );
            result.summary = summaryResult.summary_text;
          } catch (error: unknown) {
            const summaryError = error as ApiError;
            console.error(`文章 ${index + 1} 摘要错误:`, summaryError);
            result.error = `摘要生成失败: ${summaryError.message}`;
            // 继续执行其他任务，不中断
          }
        }

        if (task === 'translate' || task === 'both') {
          try {
            // 翻译原文
            const translationResult = await hfService.translate(
              article,
              sourceLanguage,
              targetLanguage
            );
            result.translatedText = translationResult.translation_text;
          } catch (error: unknown) {
            const translationError = error as ApiError;
            console.error(`文章 ${index + 1} 翻译错误:`, translationError);
            
            // 尝试使用备用翻译方法
            try {
              const fallbackResult = await hfClient.translation({
                model: 'Helsinki-NLP/opus-mt-en-zh', // 使用可靠的基础模型
                inputs: article
              }) as TranslationResult;
              result.translatedText = fallbackResult.translation_text;
              if (!result.error) result.error = '使用了备用翻译模型';
            } catch {
              // 忽略备用错误，只使用主要错误信息
              if (result.error) {
                result.error += `. 翻译失败: ${translationError.message}`;
              } else {
                result.error = `翻译失败: ${translationError.message}`;
              }
            }
          }

          // 如果已生成摘要，还需要翻译摘要
          if (result.summary) {
            try {
              const summaryTranslationResult = await hfService.translate(
                result.summary,
                'en',
                targetLanguage
              );
              result.translatedSummary = summaryTranslationResult.translation_text;
            } catch (error: unknown) {
              const summaryTransError = error as ApiError;
              console.error(`文章 ${index + 1} 摘要翻译错误:`, summaryTransError);
              // 尝试使用备用翻译方法
              try {
                const fallbackResult = await hfClient.translation({
                  model: 'Helsinki-NLP/opus-mt-en-zh',
                  inputs: result.summary
                }) as TranslationResult;
                result.translatedSummary = fallbackResult.translation_text;
              } catch {
                // 摘要翻译失败不影响整体结果
                if (result.error) {
                  result.error += `. 摘要翻译失败`;
                } else {
                  result.error = `摘要翻译失败`;
                }
              }
            }
          }
        }

        results.push(result);
      } catch (error: unknown) {
        const articleError = error as ApiError;
        console.error(`处理文章 ${index + 1} 时出错:`, articleError);
        errors.push(`文章 ${index + 1} 処理失敗: ${articleError.message}`);
        results.push({
          originalText: article,
          error: `処理失敗: ${articleError.message}`
        });
      }
    }

    return NextResponse.json({ 
      results,
      errors: errors.length > 0 ? errors : undefined,
      task,
      sourceLanguage,
      targetLanguage
    });
  } catch (error: unknown) {
    const apiError = error as ApiError;
    console.error('バッチ処理エラー:', apiError);
    return NextResponse.json(
      { error: `バッチ処理中にエラーが発生しました: ${apiError.message}` },
      { status: 500 }
    );
  }
}