// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TutorPanel } from './components/TutorPanel';
import { foundationLessons } from './data/foundations';
import type { TutorMessage } from './types';

const lesson = foundationLessons[0];
const renderMessage = (content: string, role: TutorMessage['role'] = 'assistant') => {
  const messages: TutorMessage[] = [{ role, content, createdAt: '2026-01-01T00:00:00.000Z' }];
  const html = renderToStaticMarkup(createElement(TutorPanel, { lesson, messages, onMessages: () => {} }));
  const document = new DOMParser().parseFromString(html, 'text/html');
  return { html, document };
};

describe('AI 导师 Markdown 不自动请求外部内容', () => {
  it.each(['assistant', 'user'] as const)('%s 的远程图片不能生成 img 或预加载请求', role => {
    const url = 'https://third-party.invalid/collect?value=synthetic-only';
    const { html, document } = renderMessage(`保留正常文字。\n\n![loading](${url})`, role);
    expect(document.querySelector('.tutor-markdown')?.textContent).toContain('保留正常文字');
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('link[rel="preload"]')).toBeNull();
    expect(html).not.toContain(url);
  });

  it('数据 SVG 图片和原始 HTML 不能成为可执行或可加载元素', () => {
    const payload = [
      '![svg](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=)',
      '<script>window.__syntheticTutorProbe = true</script>',
      '<img src="https://third-party.invalid/raw" onerror="window.__syntheticTutorProbe=true">',
      '<iframe src="https://third-party.invalid/frame"></iframe>',
    ].join('\n\n');
    const { document } = renderMessage(payload);
    expect(document.querySelector('.tutor-markdown')).not.toBeNull();
    expect(document.querySelector('img, script, iframe, object, embed, link[rel="preload"]')).toBeNull();
    expect(document.querySelector('[onload], [onerror], [onclick]')).toBeNull();
  });

  it('普通 HTTPS 来源保留为点击链接，危险协议被去除且没有事件处理器', () => {
    const { document } = renderMessage('[阅读来源](https://example.org/paper)\n\n[unsafe](javascript:alert%281%29)');
    const links = [...document.querySelectorAll('.tutor-markdown a')];
    const safe = links.find(link => link.textContent === '阅读来源');
    expect(safe?.getAttribute('href')).toBe('https://example.org/paper');
    expect(safe?.hasAttribute('onclick')).toBe(false);
    expect(document.querySelector('img, iframe, link[rel="preload"]')).toBeNull();
    const unsafe = links.find(link => link.textContent === 'unsafe');
    expect(unsafe).toBeDefined();
    expect(unsafe?.getAttribute('href') || '').not.toMatch(/^javascript:/i);
    for (const link of links) expect(link.hasAttribute('onclick')).toBe(false);
  });
});
