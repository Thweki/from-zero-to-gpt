import type {Lesson, TutorMessage} from './types';
import {selectionSummary} from './tutor-selection';

type Chapter = Pick<Lesson, 'id' | 'title'>;

export function tutorConversationMarkdown(lesson: Chapter, messages: readonly TutorMessage[]): string {
  const header = `# ${lesson.title} · 导师对话\n\n章节：${lesson.id}\n\n仅包含本章当前保留的对话与引用文字；不包含图片预览、未发送草稿或单独附上的代码与笔记。AI 回答请用教材和实验核对。`;
  const turns = messages.map(message => {
    const reference = message.selection
      ? `${selectionSummary(message.selection).split(/\r\n|\r|\n/).map(line => `> ${line}`).join('\n')}\n\n`
      : '';
    return `## ${message.role === 'user' ? '你' : 'AI 导师'} · ${message.createdAt}\n\n${reference}${message.content}`;
  });
  return [header, ...turns].join('\n\n---\n\n') + '\n';
}

export function downloadTutorConversation(lesson: Chapter, messages: readonly TutorMessage[]): void {
  if (!messages.length) return;
  const blob = new Blob([tutorConversationMarkdown(lesson, messages)], {type: 'text/markdown;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `from-zero-to-gpt-${lesson.id}-tutor.md`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
