import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 简单的内存存储，用于演示目的
// 实际应用中应使用数据库
const tasks: Record<string, any>[] = [];

export async function GET() {
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  try {
    const { type, data, schedule } = await request.json();

    if (!type || !data) {
      return NextResponse.json(
        { error: '缺少任务类型或数据' },
        { status: 400 }
      );
    }

    // 创建任务
    const task = {
      id: Date.now().toString(),
      type,
      data,
      schedule,
      status: 'pending',
      result: null,
      createdAt: new Date().toISOString(),
    };

    // 将任务添加到任务列表
    tasks.push(task);

    // 对于即时执行的任务，直接处理
    if (!schedule) {
      await processTask(task);
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('创建任务错误:', error);
    return NextResponse.json(
      { error: '创建任务时发生错误' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: '缺少任务ID' },
        { status: 400 }
      );
    }

    const taskIndex = tasks.findIndex(task => task.id === id);
    if (taskIndex === -1) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    // 删除任务
    tasks.splice(taskIndex, 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除任务错误:', error);
    return NextResponse.json(
      { error: '删除任务时发生错误' },
      { status: 500 }
    );
  }
}

// 处理任务的函数
async function processTask(task: Record<string, any>) {
  try {
    task.status = 'processing';

    switch (task.type) {
      case 'summarize':
        await processSummarizeTask(task);
        break;
      case 'generate':
        await processGenerateTask(task);
        break;
      case 'analyze':
        await processAnalyzeTask(task);
        break;
      default:
        task.status = 'failed';
        task.result = '不支持的任务类型';
    }

    return task;
  } catch (error) {
    console.error(`处理任务 ${task.id} 错误:`, error);
    task.status = 'failed';
    task.result = '处理任务时出错';
    return task;
  }
}

// 处理摘要任务
async function processSummarizeTask(task: Record<string, any>) {
  const { text } = task.data;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: '你是一个专业的文章摘要生成器。请生成一个简洁、全面的摘要。'
      },
      {
        role: 'user',
        content: `请为以下文章生成一个简短的摘要:\n\n${text}`
      }
    ],
    max_tokens: 150,
  });

  task.result = response.choices[0]?.message.content || '无法生成摘要';
  task.status = 'completed';
}

// 处理文本生成任务
async function processGenerateTask(task: Record<string, any>) {
  const { prompt } = task.data;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 500,
  });

  task.result = response.choices[0]?.message.content || '无法生成文本';
  task.status = 'completed';
}

// 处理文本分析任务
async function processAnalyzeTask(task: Record<string, any>) {
  const { text } = task.data;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: '你是一个文本分析专家。请分析下面的文本，提供关键点、情感倾向和主题。'
      },
      {
        role: 'user',
        content: `请分析以下文本:\n\n${text}`
      }
    ],
    max_tokens: 300,
  });

  task.result = response.choices[0]?.message.content || '无法分析文本';
  task.status = 'completed';
} 