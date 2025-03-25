import { OpenAI } from 'openai';
import { HfInference } from '@huggingface/inference';

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 初始化HuggingFace客户端
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// AI服务工具类
export class AIService {
  /**
   * 使用OpenAI生成文本
   * @param prompt 提示词
   * @param maxTokens 最大令牌数
   * @returns 生成的文本
   */
  static async generateTextWithOpenAI(prompt: string, maxTokens: number = 500): Promise<string> {
    try {
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

      return response.choices[0]?.message.content || '';
    } catch (error) {
      console.error('OpenAI文本生成错误:', error);
      throw error;
    }
  }

  /**
   * 使用Hugging Face生成文本
   * @param prompt 提示词
   * @param maxTokens 最大令牌数
   * @returns 生成的文本
   */
  static async generateTextWithHF(prompt: string, maxTokens: number = 500): Promise<string> {
    try {
      const result = await hf.textGeneration({
        model: 'gpt2',
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          return_full_text: false
        }
      });
      return result.generated_text;
    } catch (error) {
      console.error('HuggingFace文本生成错误:', error);
      throw error;
    }
  }

  /**
   * 使用OpenAI生成图像
   * @param prompt 提示词
   * @param size 图像尺寸
   * @returns 图像URL
   */
  static async generateImageWithOpenAI(
    prompt: string, 
    size: '256x256' | '512x512' | '1024x1024' = '512x512'
  ): Promise<string> {
    try {
      const response = await openai.images.generate({
        prompt: prompt,
        n: 1,
        size: size,
      });

      return response.data[0]?.url || '';
    } catch (error) {
      console.error('OpenAI图像生成错误:', error);
      throw error;
    }
  }

  /**
   * 使用Hugging Face生成图像
   * @param prompt 提示词
   * @returns 图像Base64
   */
  static async generateImageWithHF(prompt: string): Promise<string> {
    try {
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
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('HuggingFace图像生成错误:', error);
      throw error;
    }
  }

  /**
   * 使用OpenAI分析文本情感
   * @param text 待分析文本
   * @returns 情感分析结果
   */
  static async analyzeSentiment(text: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个文本情感分析专家。请分析下面文本的情感倾向（积极、消极或中性），并给出理由。'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 200,
      });

      return response.choices[0]?.message.content || '';
    } catch (error) {
      console.error('情感分析错误:', error);
      throw error;
    }
  }

  /**
   * 使用OpenAI提取文本关键词
   * @param text 待提取文本
   * @param maxKeywords 最大关键词数量
   * @returns 关键词列表
   */
  static async extractKeywords(text: string, maxKeywords: number = 5): Promise<string[]> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `你是一个关键词提取专家。请从下面的文本中提取最多${maxKeywords}个关键词，仅返回关键词，用逗号分隔。`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 100,
      });

      const keywordsText = response.choices[0]?.message.content || '';
      return keywordsText.split(',').map(k => k.trim()).filter(k => k.length > 0);
    } catch (error) {
      console.error('关键词提取错误:', error);
      throw error;
    }
  }

  /**
   * 使用OpenAI将文本翻译成指定语言
   * @param text 待翻译文本
   * @param targetLanguage 目标语言
   * @returns 翻译结果
   */
  static async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `你是一个专业翻译。请将以下文本翻译成${targetLanguage}，保持原文的意思、风格和格式。`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: text.length * 2,
      });

      return response.choices[0]?.message.content || '';
    } catch (error) {
      console.error('文本翻译错误:', error);
      throw error;
    }
  }
} 