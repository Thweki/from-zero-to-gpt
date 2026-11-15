// @vitest-environment jsdom
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TutorPanel} from './components/TutorPanel';
import {lessonById} from './data/lessons';
import {downloadTutorConversation, tutorConversationMarkdown} from './tutor-export';
import type {TutorMessage} from './types';

vi.mock('./tutor-connection', () => ({
  useTutorConnection: () => ({status: null, checking: false, error: '离线', refresh: vi.fn()}),
}));

const lesson = lessonById.functions;
const messages: TutorMessage[] = [
  {role: 'user', content: '为什么 $f(-2)=4$？🤔', createdAt: '2026-11-15T10:00:00.000Z',
    selection: {kind: 'text', title: '函数定义', text: '第一行\n\n最后一行'}},
  {role: 'assistant', content: '平方会得到正数。\n\n```python\nprint((-2) ** 2)\n```\n\n$$f(x)=x^2$$', createdAt: '2026-11-15T10:00:01.000Z'},
];

describe('readable chapter transcript', () => {
  it('preserves message order, Markdown, Unicode, timestamps and multiline references without mutation', () => {
    const before = JSON.stringify(messages);
    const markdown = tutorConversationMarkdown(lesson, messages);
    expect(markdown).toContain(`# ${lesson.title} · 导师对话\n\n章节：functions`);
    expect(markdown).toContain('## 你 · 2026-11-15T10:00:00.000Z');
    expect(markdown).toContain('> 【选中的文字：函数定义】\n> 第一行\n> \n> 最后一行');
    expect(markdown).toContain(messages[0].content);
    expect(markdown).toContain(`## AI 导师 · 2026-11-15T10:00:01.000Z\n\n${messages[1].content}`);
    expect(markdown.indexOf(messages[0].content)).toBeLessThan(markdown.indexOf(messages[1].content));
    expect(JSON.stringify(messages)).toBe(before);
  });

  it('keeps chart descriptions but excludes image data, including Windows line endings', () => {
    const markdown = tutorConversationMarkdown(lesson, [{...messages[0], selection: {
      kind: 'image', title: '平方曲线', text: 'x=-2\r\ny=4', image: 'data:image/png;base64,fixture',
    }}]);
    expect(markdown).toContain('> 【选中的图表：平方曲线】\n> x=-2\n> y=4');
    expect(markdown).not.toContain('data:image');
    expect(markdown).toContain('不包含图片预览');
  });

  it('exports a saved unanswered question without inventing an assistant response', () => {
    const markdown = tutorConversationMarkdown(lesson, messages.slice(0, 1));
    expect(markdown).toContain(messages[0].content);
    expect(markdown).not.toContain('## AI 导师');
  });
});

describe('local transcript download from the tutor panel', () => {
  let root: Root;
  let container: HTMLDivElement;
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:transcript');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('matchMedia', () => ({matches: true}));
    Object.defineProperty(Element.prototype, 'scrollIntoView', {configurable: true, value: vi.fn()});
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function exportButton() {
    const button = container.querySelector<HTMLButtonElement>('button[aria-label="导出本章导师对话（Markdown）"]');
    expect(button).not.toBeNull();
    return button!;
  }

  it.each([false, true])('downloads while offline in compact=%s, using only the displayed chapter messages', async compact => {
    const onMessages = vi.fn(), onDraft = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true);
      expect(this.download).toBe('from-zero-to-gpt-functions-tutor.md');
      expect(this.href).toBe('blob:transcript');
    });
    act(() => root.render(createElement(TutorPanel, {
      lesson, messages, compact, onMessages, onDraft,
      draft: 'unsent-draft-fixture', code: 'private-code-fixture', note: 'private-note-fixture', lastRun: 'private-error-fixture',
    })));
    expect(exportButton().disabled).toBe(false);
    act(() => exportButton().click());
    expect(click).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    vi.runOnlyPendingTimers();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:transcript');
    // FileReader exercises the actual UTF-8 Blob, not just the formatter.
    vi.useRealTimers();
    const contents = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    expect(contents).toBe(tutorConversationMarkdown(lesson, messages));
    for (const value of ['unsent-draft-fixture', 'private-code-fixture', 'private-note-fixture', 'private-error-fixture']) {
      expect(contents).not.toContain(value);
    }
    expect(onMessages).not.toHaveBeenCalled();
    expect(onDraft).not.toHaveBeenCalled();
    expect(document.querySelector('a[download]')).toBeNull();
    vi.useFakeTimers();
  });

  it('disables export after switching to an empty chapter and does not create an empty download', () => {
    act(() => root.render(createElement(TutorPanel, {lesson, messages, onMessages: vi.fn()})));
    expect(exportButton().disabled).toBe(false);
    act(() => root.render(createElement(TutorPanel, {lesson: lessonById.linear, messages: [], onMessages: vi.fn()})));
    expect(exportButton().disabled).toBe(true);
    act(() => exportButton().click());
    downloadTutorConversation(lessonById.linear, []);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('removes the download link and releases its object URL even if the download fails', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {throw new Error('download failed');});
    expect(() => downloadTutorConversation(lesson, messages)).toThrow('download failed');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:transcript');
  });
});
