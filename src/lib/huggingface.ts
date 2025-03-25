import { HfInference } from '@huggingface/inference';

// 支持的模型类型
export type ModelTask = 'summarization' | 'translation' | 'text-generation';

// 支持的语言类型
export type Language = 'auto' | 'en' | 'zh' | 'fr' | 'de' | 'es' | 'ru' | 'ja' | 'ko';

// 模型配置接口
interface ModelConfig {
  id: string;
  maxInputLength?: number;
  supportedLanguages?: Language[];
  description?: string;
}

// 摘要结果类型
export interface SummaryResult {
  summary_text: string;
  [key: string]: unknown;
}

// 翻译结果类型
interface TranslationResponse {
  translation_text: string;
}

// API请求配置
interface ApiRequestOptions {
  timeout?: number;
  retries?: number;
  delay?: number;
}

// 默认API请求配置
const DEFAULT_REQUEST_OPTIONS: ApiRequestOptions = {
  timeout: 30000, // 30秒超时
  retries: 2,     // 最多重试2次
  delay: 1000     // 重试间隔1秒
};

/**
 * 添加超时功能的Promise包装
 * @param promise 原始Promise
 * @param timeout 超时时间(毫秒)
 * @returns 带超时控制的Promise
 */
async function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`请求超时 (${timeout}ms)`)), timeout);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

/**
 * 带重试功能的异步函数包装
 * @param fn 要执行的异步函数
 * @param options 重试选项
 * @returns 带重试功能的异步函数结果
 */
async function withRetry<T>(
  fn: () => Promise<T>, 
  options: ApiRequestOptions = DEFAULT_REQUEST_OPTIONS
): Promise<T> {
  const { retries = 2, delay = 1000, timeout = 30000 } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // 首次尝试或重试
      if (attempt > 0) {
        console.log(`重试请求(${attempt}/${retries})...`);
        // 重试前等待
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
      
      // 添加超时控制
      return await withTimeout(fn(), timeout);
    } catch (error) {
      lastError = error as Error;
      console.error(`尝试 ${attempt + 1}/${retries + 1} 失败:`, lastError.message);
      
      // 如果已达到最大重试次数，抛出最后一个错误
      if (attempt === retries) {
        if (lastError.message.includes('timeout') || lastError.message.includes('超时')) {
          throw new Error(`API请求失败 (504) - 服务超时`);
        }
        throw lastError;
      }
    }
  }
  
  // 这一行应该不会执行到，但TypeScript要求返回值
  throw lastError!;
}

// 模型映射配置
const MODELS: Record<ModelTask, Record<string, ModelConfig>> = {
  'summarization': {
    'bart-large-cnn': {
      id: 'facebook/bart-large-cnn',
      description: '英文摘要模型，适合新闻和文章摘要',
      supportedLanguages: ['en'],
      maxInputLength: 1024,
    },
    'pegasus': {
      id: 'google/pegasus-xsum',
      description: '英文摘要模型，生成更简洁的摘要',
      supportedLanguages: ['en'],
      maxInputLength: 1024,
    },
    'mt5': {
      id: 'csebuetnlp/mT5_multilingual_XLSum',
      description: '多语言摘要模型，支持多种语言',
      supportedLanguages: ['en', 'zh', 'fr', 'de', 'es', 'ru'],
      maxInputLength: 1024,
    },
    'bert-chinese': {
      id: 'hfl/chinese-roberta-wwm-ext',
      description: '中文BERT模型，可用于提取式摘要',
      supportedLanguages: ['zh'],
      maxInputLength: 512,
    },
    'uer-pegasus': {
      id: 'IDEA-CCNL/Randeng-Pegasus-523M-Summary-Chinese',
      description: '中文摘要模型，适合中文内容直接摘要',
      supportedLanguages: ['zh'],
      maxInputLength: 1024,
    },
    'chinese-distilbart': {
      id: 'fnlp/bart-base-chinese',
      description: '中文BART模型，适合中文内容摘要',
      supportedLanguages: ['zh'],
      maxInputLength: 1024,
    },
    'chinese-t5': {
      id: 'uer/t5-base-chinese-cluecorpussmall',
      description: '中文T5模型，适合中文文本生成和摘要',
      supportedLanguages: ['zh'],
      maxInputLength: 1024,
    },
    'distilbart-cnn': {
      id: 'sshleifer/distilbart-cnn-12-6',
      description: '轻量级英文摘要模型，速度更快',
      supportedLanguages: ['en'],
      maxInputLength: 1024,
    },
    't5-base': {
      id: 'google/flan-t5-base',
      description: '基于T5的通用文本处理模型，有良好的摘要能力',
      supportedLanguages: ['en'],
      maxInputLength: 1024, 
    },
  },
  'translation': {
    'en-to-zh': {
      id: 'Helsinki-NLP/opus-mt-en-zh',
      description: '英文到中文翻译模型',
      supportedLanguages: ['en', 'zh'],
    },
    'zh-to-en': {
      id: 'Helsinki-NLP/opus-mt-zh-en',
      description: '中文到英文翻译模型',
      supportedLanguages: ['zh', 'en'],
    },
    'multilingual': {
      id: 'facebook/m2m100_418M',
      description: '通用多语言翻译模型，支持多种语言',
      supportedLanguages: ['auto', 'en', 'zh', 'fr', 'de', 'es', 'ru', 'ja', 'ko'],
    },
  },
  'text-generation': {
    'gpt2': {
      id: 'gpt2',
      description: '英文文本生成模型',
      supportedLanguages: ['en'],
    },
    'bloom': {
      id: 'bigscience/bloom',
      description: '多语言大型语言模型',
      supportedLanguages: ['en', 'zh', 'fr', 'de', 'es', 'ru'],
    },
  },
};

export class HuggingFaceService {
  private inference: HfInference;
  private static instance: HuggingFaceService;
  private requestOptions: ApiRequestOptions;

  private constructor() {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new Error('Hugging Face API密钥未设置');
    }
    this.inference = new HfInference(apiKey);
    this.requestOptions = {
      timeout: Number(process.env.HF_REQUEST_TIMEOUT) || DEFAULT_REQUEST_OPTIONS.timeout,
      retries: Number(process.env.HF_REQUEST_RETRIES) || DEFAULT_REQUEST_OPTIONS.retries,
      delay: Number(process.env.HF_REQUEST_DELAY) || DEFAULT_REQUEST_OPTIONS.delay
    };
  }

  public static getInstance(): HuggingFaceService {
    if (!HuggingFaceService.instance) {
      HuggingFaceService.instance = new HuggingFaceService();
    }
    return HuggingFaceService.instance;
  }

  /**
   * 获取摘要模型
   * @param modelName 模型名称
   * @returns 模型配置
   */
  public getSummarizationModel(modelName: string = 'bart-large-cnn'): ModelConfig {
    return MODELS.summarization[modelName] || MODELS.summarization['bart-large-cnn'];
  }

  /**
   * 获取翻译模型
   * @param sourceLanguage 源语言
   * @param targetLanguage 目标语言
   * @returns 模型配置
   */
  public getTranslationModel(sourceLanguage: Language, targetLanguage: Language): ModelConfig {
    if (sourceLanguage === 'en' && targetLanguage === 'zh') {
      return MODELS.translation['en-to-zh'];
    } else if (sourceLanguage === 'zh' && targetLanguage === 'en') {
      return MODELS.translation['zh-to-en'];
    } else {
      return MODELS.translation['multilingual'];
    }
  }

  /**
   * 生成文本摘要
   * @param text 原文
   * @param modelName 模型名称
   * @param maxLength 最大长度
   * @param minLength 最小长度
   * @returns 摘要结果
   */
  public async summarize(text: string, modelName: string = 'bart-large-cnn', maxLength: number = 150, minLength: number = 30): Promise<SummaryResult> {
    const modelConfig = this.getSummarizationModel(modelName);
    
    try {
      // 检测语言
      const isChinese = HuggingFaceService.isChineseText(text);
      
      // 如果是中文内容，但使用的是英文模型，自动切换到中文模型
      if (isChinese && (modelName === 'bart-large-cnn' || modelName === 'pegasus')) {
        console.log('检测到中文内容，自动切换到中文摘要模型');
        
        // 自动检测是否是技术文档
        const isTechDoc = text.includes('Firebase') || 
                         text.includes('Firestore') || 
                         text.includes('数据库') || 
                         text.includes('API') ||
                         text.includes('技术') ||
                         text.includes('编程') ||
                         text.includes('开发');
        
        // 为技术文档和普通文档选择不同的模型
        const chineseModelId = isTechDoc 
          ? MODELS.summarization['chinese-t5'].id
          : MODELS.summarization['mt5'].id;
        
        const result = await withRetry(async () => {
          return this.inference.summarization({
            model: chineseModelId,
            inputs: text,
            parameters: {
              max_length: maxLength,
              min_length: minLength
            }
          });
        }, this.requestOptions);
        
        return { summary_text: result.summary_text };
      }
      
      // 处理特殊情况
      if (modelName === 'uer-pegasus' || modelName === 'bert-chinese') {
        console.log('使用替代中文摘要模型');
        const result = await withRetry(async () => {
          return this.inference.summarization({
            model: MODELS.summarization['mt5'].id,
            inputs: text,
            parameters: {
              max_length: maxLength,
              min_length: minLength
            }
          });
        }, this.requestOptions);
        
        return { summary_text: result.summary_text };
      }
      
      // 使用指定的模型
      const result = await withRetry(async () => {
        return this.inference.summarization({
          model: modelConfig.id,
          inputs: text,
          parameters: {
            max_length: maxLength,
            min_length: minLength
          }
        });
      }, this.requestOptions);
      
      return { summary_text: result.summary_text };
    } catch (error) {
      console.error('摘要生成错误:', error);
      // 尝试使用备用模型
      console.log('尝试使用备用多语言模型mt5');
      try {
        const result = await withRetry(async () => {
          return this.inference.summarization({
            model: MODELS.summarization['mt5'].id,
            inputs: text,
            parameters: {
              max_length: maxLength,
              min_length: minLength
            }
          });
        }, {
          ...this.requestOptions,
          timeout: 45000,  // 增加备用模型的超时时间
          retries: 1       // 减少重试次数，因为这已经是备用模型
        });
        
        return { summary_text: result.summary_text };
      } catch (backupError) {
        console.error('备用摘要模型也失败:', backupError);
        // 如果所有尝试都失败，返回一个简单的摘要
        const firstChars = text.slice(0, Math.min(text.length, 100)) + '...';
        return { 
          summary_text: `摘要生成失败，请尝试其他模型。原文开头: ${firstChars}`,
          error: (backupError as Error).message
        };
      }
    }
  }

  /**
   * 翻译文本
   * @param text 原文
   * @param sourceLanguage 源语言
   * @param targetLanguage 目标语言
   * @returns 翻译结果
   */
  public async translate(text: string, sourceLanguage: Language = 'auto', targetLanguage: Language = 'zh'): Promise<TranslationResponse> {
    const modelConfig = this.getTranslationModel(sourceLanguage, targetLanguage);

    try {
      // 如果源语言是auto，尝试检测是否是中文
      if (sourceLanguage === 'auto') {
        const isChinese = HuggingFaceService.isChineseText(text);
        if (isChinese && targetLanguage === 'en') {
          // 如果是中文到英文，使用专门的中英翻译模型
          const result = await withRetry(async () => {
            return this.inference.translation({
              model: MODELS.translation['zh-to-en'].id,
              inputs: text
            });
          }, this.requestOptions);
          
          return { translation_text: result.translation_text };
        } else if (!isChinese && targetLanguage === 'zh') {
          // 如果是英文到中文，使用专门的英中翻译模型
          const result = await withRetry(async () => {
            return this.inference.translation({
              model: MODELS.translation['en-to-zh'].id,
              inputs: text
            });
          }, this.requestOptions);
          
          return { translation_text: result.translation_text };
        }
      }

      // 使用多语言模型进行翻译
      const response = await withRetry(async () => {
        return this.inference.translation({
          model: modelConfig.id,
          inputs: text,
          parameters: {
            src_lang: sourceLanguage === 'auto' ? 'en' : sourceLanguage.toUpperCase(),
            tgt_lang: targetLanguage.toUpperCase()
          }
        });
      }, this.requestOptions);

      return { translation_text: response.translation_text };
    } catch (error) {
      console.error('翻译错误:', error);
      
      // 尝试使用备用翻译模型
      console.log('尝试使用备用翻译模型');
      
      try {
        // 根据目标语言选择合适的备用模型
        const fallbackModelId = targetLanguage === 'zh' 
          ? MODELS.translation['en-to-zh'].id
          : targetLanguage === 'en'
            ? MODELS.translation['zh-to-en'].id
            : MODELS.translation['multilingual'].id;
        
        const result = await withRetry(async () => {
          return this.inference.translation({
            model: fallbackModelId,
            inputs: text
          });
        }, {
          ...this.requestOptions,
          timeout: 45000,  // 增加备用模型的超时时间
          retries: 1       // 减少重试次数，因为这已经是备用模型
        });
        
        return { translation_text: result.translation_text };
      } catch (backupError) {
        console.error('备用翻译模型也失败:', backupError);
        // 如果所有尝试都失败，返回一个提示信息
        return { 
          translation_text: `翻译失败，请尝试其他模型或稍后再试。Original text: ${text.slice(0, 50)}...` 
        };
      }
    }
  }

  /**
   * 检查文本是否包含中文字符
   * @param text 要检查的文本
   * @returns 是否包含中文字符
   */
  public static isChineseText(text: string): boolean {
    return /[\u4e00-\u9fa5]/.test(text);
  }

  /**
   * 获取HuggingFace客户端实例
   * @returns HuggingFace客户端实例
   */
  public getClient(): HfInference {
    return this.inference;
  }
} 