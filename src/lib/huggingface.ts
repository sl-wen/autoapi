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

// 错误信息定义
interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

// 默认API请求配置
const DEFAULT_REQUEST_OPTIONS: ApiRequestOptions = {
  timeout: 60000, // 增加到60秒超时
  retries: 5,     // 增加到5次重试
  delay: 3000     // 增加到3秒重试间隔
};

// 设置备用模型映射
const FALLBACK_MODELS = {
  summarization: [
    'csebuetnlp/mT5_multilingual_XLSum',  // 多语言通用模型
    'sshleifer/distilbart-cnn-12-6',      // 轻量级模型
    'facebook/bart-large-cnn'             // 常用模型
  ],
  translation: [
    'Helsinki-NLP/opus-mt-en-zh',         // 英中
    'Helsinki-NLP/opus-mt-zh-en',         // 中英
    't5-small'                           // 小型模型
  ]
};

/**
 * 解析API错误
 * @param error 错误对象
 * @returns 格式化的错误信息
 */
function parseApiError(error: unknown): Error {
  if (error instanceof Error) {
    const errorMessage = error.message;
    
    try {
      // 尝试解析错误文本
      if (errorMessage.includes('{') && errorMessage.includes('}')) {
        const jsonStart = errorMessage.indexOf('{');
        const jsonText = errorMessage.substring(jsonStart);
        const errorData = JSON.parse(jsonText) as ApiErrorResponse;
        
        if (errorData.error?.code === '504' || errorMessage.includes('504')) {
          return new Error('模型部署错误 (504): 服务器超时，请尝试其他模型或稍后重试');
        }
        
        if (errorData.error?.message) {
          return new Error(`API错误: ${errorData.error.message}`);
        }
      }
      
      // 处理特定错误
      if (errorMessage.includes('deployment') || errorMessage.includes('504')) {
        return new Error('模型部署错误: 服务器超时，请尝试其他模型或稍后重试');
      }
    } catch (e) {
      // 解析失败，使用原始错误
      console.warn('解析API错误失败', e);
    }
    
    return error;
  }
  
  // 处理非标准错误
  return new Error(`未知错误: ${String(error)}`);
}

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
  const { retries = 5, delay = 3000, timeout = 60000 } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // 首次尝试或重试
      if (attempt > 0) {
        console.log(`重试请求(${attempt}/${retries})...`);
        // 重试前等待, 使用指数退避策略
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(1.5, attempt-1)));
      }
      
      // 添加超时控制
      return await withTimeout(fn(), timeout);
    } catch (error) {
      lastError = parseApiError(error as Error);
      console.error(`尝试 ${attempt + 1}/${retries + 1} 失败:`, lastError.message);
      
      // 检查是否是部署错误，如果是则可能需要尝试不同的模型而不是继续重试
      if (lastError.message.includes('504') || 
          lastError.message.includes('部署错误') || 
          lastError.message.includes('deployment')) {
        throw lastError; // 立即中断重试，转向不同模型
      }
      
      // 如果已达到最大重试次数，抛出最后一个错误
      if (attempt === retries) {
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
    // 创建已尝试模型的集合，避免重复尝试
    const triedModels: Set<string> = new Set();
    let currentModel = modelName;
    
    // 创建备用模型列表
    const fallbackModels = [...FALLBACK_MODELS.summarization];
    if (modelName && !fallbackModels.includes(modelName)) {
      fallbackModels.unshift(modelName); // 确保首先尝试用户指定的模型
    }
    
    // 处理中文内容
    const isChinese = HuggingFaceService.isChineseText(text);
    if (isChinese && (currentModel === 'bart-large-cnn' || currentModel === 'pegasus')) {
      console.log('检测到中文内容，优先使用中文摘要模型');
      fallbackModels.unshift('mt5'); // 中文内容优先使用mt5
    }
    
    let lastError: Error | null = null;
    
    // 逐个尝试模型直到成功
    for (const model of fallbackModels) {
      if (triedModels.has(model)) continue;
      
      triedModels.add(model);
      currentModel = model;
      console.log(`尝试使用摘要模型: ${model}`);
      
      try {
        // 根据模型ID获取完整模型路径
        const modelConfig = this.getSummarizationModel(model.includes('/') ? model : currentModel);
        const modelId = model.includes('/') ? model : modelConfig.id;
        
        const result = await withRetry(async () => {
          return this.inference.summarization({
            model: modelId,
            inputs: text,
            parameters: {
              max_length: maxLength,
              min_length: minLength
            }
          });
        }, this.requestOptions);
        
        return { summary_text: result.summary_text };
      } catch (error) {
        lastError = parseApiError(error as Error);
        console.error(`模型 ${model} 失败:`, lastError.message);
        
        // 如果不是部署或超时错误，可能是其他原因，尝试不同模型
        continue;
      }
    }
    
    // 如果所有模型都失败，返回错误信息
    console.error('所有摘要模型尝试失败');
    const firstChars = text.slice(0, Math.min(text.length, 100)) + '...';
    return { 
      summary_text: `摘要生成失败，服务暂时不可用(${lastError?.message || '未知错误'})。原文开头: ${firstChars}`,
      error: lastError?.message || '摘要生成失败'
    };
  }

  /**
   * 翻译文本
   * @param text 原文
   * @param sourceLanguage 源语言
   * @param targetLanguage 目标语言
   * @returns 翻译结果
   */
  public async translate(text: string, sourceLanguage: Language = 'auto', targetLanguage: Language = 'zh'): Promise<TranslationResponse> {
    // 创建已尝试模型集合
    const triedModels: Set<string> = new Set();
    
    // 构建备用模型列表
    const fallbackModels: string[] = [...FALLBACK_MODELS.translation];
    
    // 根据语言对确定特定模型
    if (sourceLanguage === 'en' && targetLanguage === 'zh') {
      fallbackModels.unshift('Helsinki-NLP/opus-mt-en-zh');
    } else if (sourceLanguage === 'zh' && targetLanguage === 'en') {
      fallbackModels.unshift('Helsinki-NLP/opus-mt-zh-en');
    } else {
      fallbackModels.unshift('facebook/m2m100_418M');
    }
    
    // 自动检测语言
    if (sourceLanguage === 'auto') {
      const isChinese = HuggingFaceService.isChineseText(text);
      if (isChinese && targetLanguage === 'en') {
        fallbackModels.unshift('Helsinki-NLP/opus-mt-zh-en');
      } else if (!isChinese && targetLanguage === 'zh') {
        fallbackModels.unshift('Helsinki-NLP/opus-mt-en-zh');
      }
    }
    
    let lastError: Error | null = null;
    
    // 逐个尝试模型
    for (const modelId of fallbackModels) {
      if (triedModels.has(modelId)) continue;
      
      triedModels.add(modelId);
      console.log(`尝试使用翻译模型: ${modelId}`);
      
      try {
        const result = await withRetry(async () => {
          return this.inference.translation({
            model: modelId,
            inputs: text,
            parameters: sourceLanguage !== 'auto' && modelId.includes('m2m100') ? {
              src_lang: sourceLanguage.toUpperCase(),
              tgt_lang: targetLanguage.toUpperCase()
            } : undefined
          });
        }, this.requestOptions);
        
        return { translation_text: result.translation_text };
      } catch (error) {
        lastError = parseApiError(error as Error);
        console.error(`模型 ${modelId} 失败:`, lastError.message);
        continue;
      }
    }
    
    // 如果所有模型都失败，返回错误提示
    const shortText = text.length > 50 ? text.slice(0, 50) + '...' : text;
    return { 
      translation_text: `翻译失败，服务暂时不可用(${lastError?.message || '未知错误'})。原文: ${shortText}` 
    };
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