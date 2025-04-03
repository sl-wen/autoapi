import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { HuggingFaceService, Language } from '@/lib/huggingface';

// 定义错误类型接口
interface ApiError extends Error {
  message: string;
  code?: string;
  status?: number;
}

// 定义摘要结果接口
interface SummaryResult {
  summary_text: string;
  [key: string]: unknown;
}

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, model = 'openai', maxLength = 150, language = 'zh', context = 'general' } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: '缺少文本内容' },
        { status: 400 }
      );
    }

    let summary = '';
    let originalSummary = ''; // 保存原始摘要，用于前端显示
    let actualModel = model; // 创建一个可变副本

    // 根据选择的模型使用不同的AI服务
    if (actualModel === 'openai') {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: context === 'tech_docs' 
                ? '你是一个专业的技术文档摘要生成器，擅长总结技术内容、API文档和编程概念。'
                : '你是一个专业的文章摘要生成器。请生成一个简洁、全面的摘要。'
            },
            {
              role: 'user',
              content: context === 'tech_docs'
                ? `请为这篇关于Firebase/Firestore的技术文章生成一个不超过${maxLength}字的摘要，使用${language === 'zh' ? '中文' : '英文'}，重点突出主要功能和技术特点:\n\n${text}`
                : `请为以下文章生成一个不超过${maxLength}字的摘要，使用${language === 'zh' ? '中文' : '英文'}:\n\n${text}`
            }
          ],
          max_tokens: maxLength * 2,
        });

        summary = response.choices[0]?.message.content || '无法生成摘要';
      } catch (error) {
        const openaiError = error as ApiError;
        console.error('OpenAI摘要错误:', openaiError);
        // 如果OpenAI错误，尝试使用HuggingFace备用
        if (openaiError.message.includes('API key')) {
          throw new Error(`OpenAI API密钥错误: ${openaiError.message}`);
        } else {
          console.log('OpenAI错误，尝试使用HuggingFace备用');
          actualModel = 'huggingface:bart-large-cnn'; // 切换到HuggingFace
        }
      }
    }

    if (actualModel.startsWith('huggingface')) {
      try {
        // 初始化HuggingFace服务
        const hfService = HuggingFaceService.getInstance();
        const hfClient = hfService.getClient();
        
        // 解析模型名称，格式为 "huggingface:modelName"
        let modelName = 'bart-large-cnn'; // 默认模型
        if (actualModel.includes(':')) {
          modelName = actualModel.split(':')[1];
        }
        
        // 自动检测是否需要使用中文模型
        const isChinese = HuggingFaceService.isChineseText(text);
        if (isChinese && language === 'zh') {
          // 对于中文内容默认使用中文模型，除非明确指定了其他模型
          if (modelName === 'bart-large-cnn' || modelName === 'pegasus') {
            console.log('检测到中文内容，推荐使用中文摘要模型');
            modelName = 'uer-pegasus';
          }
        }
        
        // 调用摘要服务
        let summaryResult: SummaryResult;
        try {
          summaryResult = await hfService.summarize(
            text, 
            modelName, 
            maxLength, 
            Math.min(30, maxLength / 3)
          );
        } catch (error) {
          const initialError = error as ApiError;
          console.error('初始摘要模型失败，尝试备用模型:', initialError);
          // 如果初始模型失败，尝试使用更通用的模型
          if (modelName !== 'mt5') {
            summaryResult = await hfService.summarize(
              text,
              'mt5', // 多语言模型作为备用
              maxLength,
              Math.min(30, maxLength / 3)
            );
          } else {
            throw initialError;
          }
        }
        
        summary = summaryResult.summary_text;
        originalSummary = summary; // 保存原始摘要副本
        
        // 处理空摘要或摘要太短的情况
        if (!summary || summary.trim().length < 10) {
          console.log('摘要内容太短或为空，尝试OpenAI备用');
          try {
            // 如果HuggingFace摘要质量差，尝试使用OpenAI备用
            if (process.env.OPENAI_API_KEY) {
              const openAIResponse = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: '你是一个专业的文章摘要生成器。请生成一个简洁、准确、全面的摘要。'
                  },
                  {
                    role: 'user',
                    content: `请为这篇技术文章生成一个不超过${maxLength}字的摘要，重点突出文章的主题和核心技术点，使用${language === 'zh' ? '中文' : '英文'}:\n\n${text}`
                  }
                ],
                max_tokens: maxLength * 2,
              });
              summary = openAIResponse.choices[0]?.message.content || summary;
              originalSummary = summary;
            } else {
              // 如果无法使用OpenAI，尝试其他HuggingFace模型
              const altModelName = modelName === 'mt5' ? 'bart-large-cnn' : 'mt5';
              const altSummaryResult = await hfService.summarize(
                text,
                altModelName,
                maxLength,
                Math.min(30, maxLength / 3)
              );
              summary = altSummaryResult.summary_text;
            }
          } catch (altError) {
            console.error('备用摘要模型也失败:', altError);
            // 如果备用也失败，尝试提取文章的前几句话作为摘要
            const firstSentences = text.split(/[.!?。！？]/).slice(0, 3).join('. ');
            if (firstSentences && firstSentences.length > 20) {
              summary = firstSentences + (language === 'zh' ? '...' : '...');
            }
          }
        }
        
        // 检查摘要质量，确保摘要不是原文的简单复制
        if (summary && text.includes(summary) && summary.length > 20) {
          console.log('检测到摘要可能是原文片段，尝试OpenAI生成更好的摘要');
          try {
            // 尝试使用OpenAI重新生成高质量摘要
            if (process.env.OPENAI_API_KEY) {
              const betterResponse = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: '你是一个专业的技术文章摘要生成器。请生成一个简洁、准确、全面的摘要，不要简单复制原文片段。'
                  },
                  {
                    role: 'user',
                    content: `请为这篇关于Firebase/Firestore的技术文章生成一个不超过${maxLength}字的摘要，使用${language === 'zh' ? '中文' : '英文'}，注意突出核心技术概念:\n\n${text}`
                  }
                ],
                max_tokens: maxLength * 2,
              });
              const betterSummary = betterResponse.choices[0]?.message.content;
              if (betterSummary && betterSummary.length >= 10) {
                summary = betterSummary;
                originalSummary = summary;
              }
            } else {
              // 如果无法使用OpenAI，尝试不同的HuggingFace模型
              const betterSummaryResult = await hfService.summarize(
                text,
                modelName === 'mt5' ? 'bart-large-cnn' : 'mt5',
                maxLength,
                Math.min(30, maxLength / 3)
              );
              if (betterSummaryResult.summary_text && 
                  betterSummaryResult.summary_text.length >= 10 && 
                  !text.includes(betterSummaryResult.summary_text)) {
                summary = betterSummaryResult.summary_text;
                originalSummary = summary;
              }
            }
          } catch (qualityError) {
            console.error('尝试提高摘要质量失败:', qualityError);
          }
        }
        
        // 如果此时摘要是空的或者太短，作为最后手段，从文本中提取关键句
        if (!summary || summary.trim().length < 10) {
          // 提取包含Firebase或Firestore的句子
          const keywordSentences = text.split(/[.!?。！？]/)
            .filter((sentence: string) => 
              sentence.includes('Firebase') || 
              sentence.includes('Firestore') ||
              sentence.includes('数据库') ||
              sentence.includes('云服务'))
            .slice(0, 2)
            .join('. ');
          
          if (keywordSentences && keywordSentences.length > 10) {
            summary = keywordSentences + (language === 'zh' ? '...' : '...');
            originalSummary = summary;
          }
        }
        
        // 如果需要中文输出但模型输出是英文，则翻译
        if (language === 'zh' && !HuggingFaceService.isChineseText(summary)) {
          try {
            // 先尝试使用OpenAI进行高质量翻译
            if (process.env.OPENAI_API_KEY) {
              const translationResponse = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: '你是一个专业的英译中翻译专家，尤其擅长技术文档翻译。'
                  },
                  {
                    role: 'user',
                    content: `请将以下技术摘要翻译成流畅、专业的中文:\n\n${summary}`
                  }
                ],
                max_tokens: maxLength * 2,
              });
              const translatedSummary = translationResponse.choices[0]?.message.content;
              if (translatedSummary && translatedSummary.length > 0) {
                summary = translatedSummary;
              }
            } else {
              // 如果没有OpenAI，使用HuggingFace翻译
              const translationResult = await hfService.translate(
                summary, 
                'en' as Language, 
                'zh' as Language
              );
              summary = translationResult.translation_text;
            }
          } catch (error) {
            const translationError = error as ApiError;
            console.error('摘要翻译错误:', translationError);
            // 尝试直接使用翻译模型
            try {
              const fallbackResult = await hfClient.request({
                model: 'Helsinki-NLP/opus-mt-en-zh',
                inputs: summary,
                task: 'translation'
              });
              // Handle array response from direct client translation
              const translatedText = Array.isArray(fallbackResult) 
                ? (fallbackResult[0] as { translation_text: string })?.translation_text 
                : (fallbackResult as { translation_text: string })?.translation_text;
              summary = translatedText || summary;
            } catch (error) {
              const backupError = error as ApiError;
              console.error('备用翻译也失败:', backupError);
              // 保留原摘要，添加注意事项
              summary = `[注意：翻译失败] ${summary}`;
            }
          }
        }
      } catch (error) {
        const hfError = error as ApiError;
        console.error('HuggingFace摘要错误:', hfError);
        
        // 如果HuggingFace彻底失败，尝试使用OpenAI
        if (process.env.OPENAI_API_KEY) {
          try {
            console.log('HuggingFace失败，尝试使用OpenAI');
            const openAIResponse = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [
                {
                  role: 'system',
                  content: '你是一个专业的文章摘要生成器。请生成一个简洁、准确、全面的摘要。'
                },
                {
                  role: 'user',
                  content: `请为这篇关于Firebase/Firestore的技术文章生成一个不超过${maxLength}字的摘要，使用${language === 'zh' ? '中文' : '英文'}:\n\n${text}`
                }
              ],
              max_tokens: maxLength * 2,
            });
            summary = openAIResponse.choices[0]?.message.content || '';
            originalSummary = summary;
          } catch (openAIError) {
            console.error('OpenAI备用也失败:', openAIError);
            throw new Error(`生成摘要时出错: ${hfError.message}`);
          }
        } else {
          throw new Error(`生成摘要时出错: ${hfError.message}`);
        }
      }
    }

    if (!summary) {
      return NextResponse.json(
        { error: '所有摘要方法均失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      summary, 
      model: actualModel, 
      language,
      originalSummary: language === 'zh' && !HuggingFaceService.isChineseText(originalSummary) ? originalSummary : undefined
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('摘要生成错误:', apiError);
    return NextResponse.json(
      { error: `生成摘要时发生错误: ${apiError.message}` },
      { status: 500 }
    );
  }
}