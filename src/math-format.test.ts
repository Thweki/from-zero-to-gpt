import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { lessons } from './data/lessons';
import { mathPartToLatex, plainMathToLatex, splitMathText } from './math-format';
import { MathContent, MathText } from './components/Formula';

function lessonText(lesson: (typeof lessons)[number]) {
  return [
    lesson.subtitle, lesson.problem, lesson.formulaCaption, lesson.labTask, lesson.exercise, lesson.codeExplanation,
    ...lesson.goals, ...lesson.misconceptions,
    ...[...lesson.intuition, ...lesson.math, ...lesson.deep].flatMap(section => [section.title, ...section.paragraphs]),
    lesson.quiz.question, ...lesson.quiz.options, lesson.quiz.hint, lesson.quiz.explanation,
  ];
}

describe('统一数学文本渲染', () => {
  it('转换上下标、希腊字母、求和与中文条件表达式', () => {
    expect(plainMathToLatex('f(x) = x²')).toBe('f(x) = x^{2}');
    expect(plainMathToLatex('Aᵢⱼ → (Aᵀ)ⱼᵢ')).toBe('A_{ij} \\to (A^{T})_{ji}');
    expect(plainMathToLatex('μ=Σpᵢxᵢ')).toBe('\\mu=\\sum p_{i}x_{i}');
    expect(plainMathToLatex('P(下一个 Token|前文)')).toBe('P(\\text{下一个 }Token|\\text{前文})');
  });

  it('不把界面分隔符或普通英文误判为公式', () => {
    expect(splitMathText('LIVE · 所有矩阵')).toEqual([{ type: 'text', value: 'LIVE · 所有矩阵' }]);
    expect(splitMathText('SFT / DPO')).toEqual([{ type: 'text', value: 'SFT / DPO' }]);
    expect(splitMathText('OpenAI 与 PyTorch')).toEqual([{ type: 'text', value: 'OpenAI 与 PyTorch' }]);
    expect(splitMathText('PyTorch · scaled_dot_product_attention')).toEqual([{ type: 'text', value: 'PyTorch · scaled_dot_product_attention' }]);
    expect(splitMathText('/8')).toEqual([{ type: 'text', value: '/8' }]);
  });

  it('识别中文语境的单字母变量和段尾等号', () => {
    expect(splitMathText('输入 x 与斜率 k').filter(part => part.type === 'math').map(part => part.value)).toEqual(['x', 'k']);
    expect(splitMathText('Σ q = ').some(part => part.type === 'math')).toBe(true);
  });

  it.each(lessons)('$title 的行内公式均可由严格 KaTeX 渲染', lesson => {
    for (const text of lessonText(lesson)) {
      for (const part of splitMathText(text)) {
        if (part.type !== 'math') continue;
        const latex = mathPartToLatex(part);
        expect(() => katex.renderToString(latex, { throwOnError: true, strict: 'error' }), `${text} → ${latex}`).not.toThrow();
      }
    }
  });

  it('递归处理文本但保留代码、SVG 和已有公式', () => {
    const html = renderToStaticMarkup(createElement(MathContent, null,
      createElement('p', null, '函数 f(x)=x²'),
      createElement('code', null, 'x ** 2'),
      createElement('svg', null, createElement('text', null, 'x²')),
      createElement(MathText, null, 'μ=Σpᵢxᵢ'),
    ));
    expect(html).toContain('class="katex"');
    expect(html).toContain('<code>x ** 2</code>');
    expect(html).toContain('<svg><text>x²</text></svg>');
    expect(html).not.toContain('class="katex-error"');
  });
});
