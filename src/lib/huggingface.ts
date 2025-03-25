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

  private constructor() {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new Error('Hugging Face API密钥未设置');
    }
    this.inference = new HfInference(apiKey);
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
  public async summarize(text: string, modelName: string = 'bart-large-cnn', maxLength: number = 150, minLength: number = 30) {
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
        // 使用确认可用的模型
        const chineseModelId = isTechDoc 
          ? MODELS.summarization['chinese-t5'].id  // 对技术文档使用T5模型
          : MODELS.summarization['mt5'].id;  // 默认使用多语言模型，确保可用
        
        return this.inference.summarization({
          model: chineseModelId,
          inputs: text,
          parameters: {
            max_length: maxLength,
            min_length: minLength
          }
        });
      }
      
      // 处理特殊情况 - 如果用户选择了可能不存在的模型，使用可靠的备选
      if (modelName === 'uer-pegasus') {
        console.log('使用替代中文摘要模型');
        return this.inference.summarization({
          model: MODELS.summarization['mt5'].id, // 使用可靠的多语言模型
          inputs: text,
          parameters: {
            max_length: maxLength,
            min_length: minLength
          }
        });
      }
      
      if (modelName === 'bert-chinese') {
        console.log('使用替代中文BERT模型');
        return this.inference.summarization({
          model: MODELS.summarization['chinese-t5'].id, // 使用替代中文模型
          inputs: text,
          parameters: {
            max_length: maxLength,
            min_length: minLength
          }
        });
      }
      
      // 如果明确指定了特定模型，则使用指定的模型
      return this.inference.summarization({
        model: modelConfig.id,
        inputs: text,
        parameters: {
          max_length: maxLength,
          min_length: minLength
        }
      });
    } catch (error) {
      console.error('摘要生成错误:', error);
      // 尝试使用备用模型 - 优先使用mt5，因为它已被证明可用
      console.log('尝试使用备用多语言模型mt5');
      return this.inference.summarization({
        model: MODELS.summarization['mt5'].id,
        inputs: text,
        parameters: {
          max_length: maxLength,
          min_length: minLength
        }
      });
    }
  }

  /**
   * 翻译文本
   * @param text 原文
   * @param sourceLanguage 源语言
   * @param targetLanguage 目标语言
   * @returns 翻译结果
   */
  public async translate(text: string, sourceLanguage: Language = 'auto', targetLanguage: Language = 'zh'): Promise<{translation_text: string}> {
    // 选择最适合的翻译模型
    let modelId = '';
    
    // 对于中文和英文之间的翻译，我们使用特定的双语模型
    if ((sourceLanguage === 'en' || HuggingFaceService.isChineseText(text)) && targetLanguage === 'zh') {
      modelId = 'Helsinki-NLP/opus-mt-en-zh';
      console.log('使用英译中模型:', modelId);
    } else if ((sourceLanguage === 'zh' || HuggingFaceService.isChineseText(text)) && targetLanguage === 'en') {
      modelId = 'Helsinki-NLP/opus-mt-zh-en';
      console.log('使用中译英模型:', modelId);
    } else {
      // 对于其他语言组合，使用多语言模型
      modelId = 'facebook/m2m100_418M';
      console.log('使用多语言模型:', modelId);
    }
    
    try {
      // 为Facebook多语言模型准备特殊处理
      if (modelId === 'facebook/m2m100_418M') {
        // 为m2m100模型，使用原始请求并明确指定目标语言
        console.log(`使用M2M100多语言模型，目标语言: ${targetLanguage}`);
        
        // 需要将语言代码转换为M2M100期望的格式
        const langCodeMap: Record<string, string> = {
          'en': 'en',
          'zh': 'zh',
          'fr': 'fr',
          'de': 'de',
          'es': 'es',
          'ru': 'ru',
          'ja': 'ja',
          'ko': 'ko',
          'auto': 'en' // 默认为英语
        };
        
        const targetLangCode = langCodeMap[targetLanguage] || 'zh';
        const result = await this.inference.request({
          model: modelId,
          inputs: text,
          parameters: {
            forced_bos_token_id: targetLangCode
          }
        });
        
        // 处理返回结果
        if (typeof result === 'string') {
          return { translation_text: result };
        } else if (Array.isArray(result) && result.length > 0) {
          if (typeof result[0] === 'string') {
            return { translation_text: result[0] };
          } else if (result[0] && typeof (result[0] as any).generated_text === 'string') {
            return { translation_text: (result[0] as any).generated_text };
          }
        }
        
        // 如果无法解析结果，使用JSON字符串作为回退
        console.warn('无法解析M2M100翻译结果:', result);
        return { translation_text: JSON.stringify(result) };
      }
      
      // 对于Helsinki模型，直接使用标准调用
      console.log(`使用模型: ${modelId} 进行翻译`);
      const result = await this.inference.request({
        model: modelId,
        inputs: text,
        task: "translation"
      });
      
      // 处理返回结果
      if (typeof result === 'string') {
        return { translation_text: result };
      } else if (Array.isArray(result) && result.length > 0) {
        if (typeof result[0] === 'string') {
          return { translation_text: result[0] };
        } else if (result[0] && typeof (result[0] as any).translation_text === 'string') {
          return result[0] as {translation_text: string};
        }
      } else if (result && typeof (result as any).translation_text === 'string') {
        return result as {translation_text: string};
      }
      
      // 如果无法解析结果，尝试解析generated_text
      if (result && Array.isArray(result) && result.length > 0 && typeof (result[0] as any).generated_text === 'string') {
        return { translation_text: (result[0] as any).generated_text };
      }
      
      // 最后的回退选项
      console.warn('无法解析翻译结果，使用原始返回:', result);
      return { translation_text: typeof result === 'string' ? result : JSON.stringify(result) };
      
    } catch (error: any) {
      console.error('翻译错误，尝试备用模型:', error);
      
      // 如果失败，回退到最可靠的Helsinki模型
      try {
        console.log('使用备用翻译模型: Helsinki-NLP/opus-mt-en-zh');
        const backupResult = await this.inference.request({
          model: 'Helsinki-NLP/opus-mt-en-zh',
          inputs: text,
          task: "translation"
        });
        
        // 处理返回结果
        if (typeof backupResult === 'string') {
          return { translation_text: backupResult };
        } else if (Array.isArray(backupResult) && backupResult.length > 0) {
          if (typeof backupResult[0] === 'string') {
            return { translation_text: backupResult[0] };
          } else if (backupResult[0] && typeof (backupResult[0] as any).translation_text === 'string') {
            return backupResult[0] as {translation_text: string};
          }
        } else if (backupResult && typeof (backupResult as any).translation_text === 'string') {
          return backupResult as {translation_text: string};
        }
        
        // 备用方案：如果无法解析，返回原始结果
        return { translation_text: typeof backupResult === 'string' ? backupResult : JSON.stringify(backupResult) };
        
      } catch (backupError) {
        console.error('备用翻译也失败:', backupError);
        throw new Error(`翻译失败: ${error.message}`);
      }
    }
  }

  /**
   * 检测语言是否为中文
   * @param text 文本
   * @returns 是否为中文
   */
  public static isChineseText(text: string): boolean {
    return /[\u4e00-\u9fa5]/.test(text);
  }

  /**
   * 获取Hugging Face客户端实例
   * @returns HfInference实例
   */
  public getClient(): HfInference {
    return this.inference;
  }
} 