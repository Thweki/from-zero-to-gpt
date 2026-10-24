import { expect, test, type Page } from '@playwright/test';
import graph from '../src/data/knowledge-graph.json' with { type: 'json' };
import { lessons } from '../src/data/lessons';

async function noPageOverflow(page: Page, context: string) {
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(size.width, `${context}: the page itself must fit its viewport; wide tables may scroll inside their containers`).toBeLessThanOrEqual(size.viewport + 1);
}

async function openLab(page: Page, id: string) {
  await page.goto(`/#/lesson/${id}`);
  const lab = page.getByRole('region', { name: '交互式数学实验', exact: true });
  await expect(lab).toBeVisible();
  await expect(lab.locator('.lab-loading')).toHaveCount(0);
  return lab;
}

test('课程图与实际教材构成完整的 83 课，而不是规划占位页', () => {
  expect(graph.nodes).toHaveLength(83);
  expect(graph.nodes.every(node => node.available)).toBe(true);
  expect(lessons).toHaveLength(83);
  expect(new Set(lessons.map(lesson => lesson.id))).toEqual(new Set(graph.nodes.map(node => node.id)));
});

test.describe('全部 83 个章节页面与四种解释模式', () => {
  for (const node of graph.nodes) {
    test(`阶段 ${node.stage} · ${node.id} · ${node.title}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const lesson = lessons.find(candidate => candidate.id === node.id);
      expect(lesson, `缺少实际教材：${node.id}`).toBeDefined();
      if (!lesson) throw new Error(`Missing lesson ${node.id}`);
      await page.goto(`/#/lesson/${node.id}`);
      await expect(page.locator('.lesson-page').getByRole('heading', { name: `${node.title}`, exact: true })).toBeVisible();
      await expect(page.getByRole('tablist', { name: '解释模式' }).getByRole('tab')).toHaveCount(4);
      await expect(page.locator('.quiz-options input[type="radio"]')).toHaveCount(4);
      const lab = page.getByRole('region', { name: '交互式数学实验', exact: true });
      await expect(lab).toBeVisible();
      await expect(lab.locator('.lab-loading')).toHaveCount(0);

      for (const [mode, title] of [['intuition', '直觉理解'], ['math', '数学推导'], ['code', '代码实现'], ['deep', '深入研究']] as const) {
        const tab = page.getByRole('tab', { name: title, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        const content = page.getByRole('tabpanel');
        await expect(content).toHaveAttribute('data-mode',mode);
        await expect(content.locator('#lesson-experiment')).toHaveCount(mode==='intuition'?1:0);
        await expect(content.locator('.quiz-card')).toHaveCount(mode==='intuition'?1:0);
        await expect(content.locator('.code-lab')).toHaveCount(mode==='code'?1:0);
        await expect(content.locator('.references a')).toHaveCount(mode==='deep'?lesson.references.length:0);
        await expect(content.locator('.exercise-section')).toHaveCount(mode==='code'?1:0);
        if(mode==='intuition')await expect(content.locator('.problem-callout')).toContainText(lesson.problem);
        else await expect(content.locator('.problem-callout')).toHaveCount(0);
        if (mode === 'code') {
          await expect(page.getByLabel('Python 代码编辑器', { exact: true })).toHaveValue(lesson.starter);
          await expect(content.getByText(lesson.codeExplanation,{exact:true})).toHaveCount(1);
          await expect(content.locator('.exercise-section')).toContainText(lesson.exercise);
          await content.getByRole('button', { name: '对照参考', exact: true }).click();
          await expect(content.locator('.reference-code pre')).toContainText(lesson.reference);
          await content.getByText('查看实际运行的验收测试', { exact: true }).click();
          await expect(content.locator('.test-source pre')).toContainText(lesson.pythonTests);
        } else {
          const sections = mode === 'math' ? lesson.math : mode === 'deep' ? lesson.deep : lesson.intuition;
          await expect(content.locator('.prose-section')).toHaveCount(sections.length);
          for (let i = 0; i < sections.length; i++) {
            await expect(content.locator('.prose-section').nth(i)).toContainText(sections[i].paragraphs[0]);
          }
          if(mode==='math')await expect(content.locator('.katex')).not.toHaveCount(0);
          await expect(content.locator('.katex-error')).toHaveCount(0);
        }
        await noPageOverflow(page, `${node.id}/${mode}`);
      }
      expect(errors, `${node.id} emitted uncaught browser errors`).toEqual([]);
    });
  }
});

test.describe('真实实验操作与刷新后的参数恢复', () => {
  test('代数实验区分唯一解、无解与恒等式，原生键盘操作与参数保存有效', async ({ page }) => {
    const lab = await openLab(page, 'algebra');
    await lab.getByRole('slider', { name: '系数 a', exact: true }).fill('2');
    await lab.getByRole('slider', { name: '常数 b', exact: true }).fill('-4');
    await lab.getByRole('slider', { name: '右侧 c', exact: true }).fill('10');
    await expect(lab.locator('.am-stat').first().locator('strong')).toHaveText('唯一解 x=7');
    const rhs = lab.getByRole('slider', { name: '右侧 c', exact: true });
    await rhs.focus();
    await rhs.press('ArrowRight');
    await expect(rhs).toHaveValue('10.5');
    await expect(lab.locator('.am-stat').first().locator('strong')).toHaveText('唯一解 x=7.25');
    await expect(lab.locator('.am-stat').nth(1).locator('strong')).toHaveText('0');
    await lab.getByRole('slider', { name: '系数 a', exact: true }).fill('0');
    await expect(lab.locator('.am-stat').first().locator('strong')).toHaveText('无解');
    await rhs.fill('-4');
    await expect(lab.locator('.am-stat').first().locator('strong')).toHaveText('无穷多解');
    expect(await lab.locator('svg').evaluateAll(elements => elements.some(svg => /NaN|Infinity/.test(svg.outerHTML)))).toBe(false);
    await expect(page.locator('.autosave')).toContainText('已本地保存');
    await page.reload();
    await expect(page.getByRole('slider', { name: '系数 a', exact: true })).toHaveValue('0');
    await expect(page.locator('.am-stat').first().locator('strong')).toHaveText('无穷多解');
  });

  test('回归执行真实梯度更新，训练与验证误差独立显示并恢复参数', async ({ page }) => {
    const lab = await openLab(page, 'training-regression');
    const first = Number(await lab.getByTestId('ml-train-loss').textContent());
    expect(first).toBeGreaterThan(0);
    await lab.getByRole('button', { name: '单步训练', exact: true }).click();
    await expect(lab).toContainText('已更新 1 步');
    expect(Number(await lab.getByTestId('ml-train-loss').textContent())).toBeLessThan(first);
    await lab.getByRole('button', { name: '连续训练 60 步', exact: true }).click();
    await expect(lab).toContainText('已更新 61 步');
    const trainLoss = await lab.getByTestId('ml-train-loss').textContent();
    const validationLoss = await lab.getByTestId('ml-validation-loss').textContent();
    expect(Number(trainLoss)).toBeLessThan(first);
    expect(Number(validationLoss)).toBeGreaterThan(0);
    const weight = await lab.getByRole('slider', { name: '权重 w', exact: true }).inputValue();
    const bias = await lab.getByRole('slider', { name: '偏置 b', exact: true }).inputValue();
    await expect(page.locator('.autosave')).toContainText('已本地保存');
    await page.reload();
    await expect(page.getByRole('slider', { name: '权重 w', exact: true })).toHaveValue(weight);
    await expect(page.getByRole('slider', { name: '偏置 b', exact: true })).toHaveValue(bias);
    await expect(page.getByTestId('ml-train-loss')).toHaveText(trainLoss!);
    await expect(page.getByTestId('ml-validation-loss')).toHaveText(validationLoss!);
    // Noise creates an irreducible residual: compare convergence against the
    // separately solved least-squares optimum, rather than an arbitrary ratio.
    await page.getByRole('button', { name: '最小二乘拟合', exact: true }).click();
    expect(Number(await page.getByTestId('ml-train-loss').textContent())).toBeCloseTo(Number(trainLoss), 4);
  });

  test('改变容量和标签噪声后，最小二乘真实呈现欠拟合与过拟合', async ({ page }) => {
    const lab = await openLab(page, 'generalization');
    await lab.getByRole('slider', { name: '标签噪声强度', exact: true }).fill('0');
    await lab.getByRole('slider', { name: '多项式次数 d', exact: true }).fill('2');
    await expect(lab.getByTestId('ml-train-loss')).toHaveText('0.0000');
    await expect(lab.getByTestId('ml-validation-loss')).toHaveText('0.0000');
    await lab.getByRole('slider', { name: '多项式次数 d', exact: true }).fill('1');
    expect(Number(await lab.getByTestId('ml-train-loss').textContent())).toBeGreaterThan(0.05);
    await lab.getByRole('slider', { name: '训练集比例', exact: true }).fill('0.5');
    await lab.getByRole('slider', { name: '标签噪声强度', exact: true }).fill('0.4');
    await lab.getByRole('slider', { name: '多项式次数 d', exact: true }).fill('2');
    const quadratic = { train: Number(await lab.getByTestId('ml-train-loss').textContent()), validation: Number(await lab.getByTestId('ml-validation-loss').textContent()) };
    await lab.getByRole('slider', { name: '多项式次数 d', exact: true }).fill('9');
    expect(Number(await lab.getByTestId('ml-train-loss').textContent())).toBeLessThan(quadratic.train);
    expect(Number(await lab.getByTestId('ml-validation-loss').textContent())).toBeGreaterThan(quadratic.validation);
    await expect(page.locator('.autosave')).toContainText('已本地保存');
    await page.reload();
    await expect(page.getByRole('slider', { name: '多项式次数 d', exact: true })).toHaveValue('9');
    await expect(page.getByRole('slider', { name: '训练集比例', exact: true })).toHaveValue('0.5');
  });

  test('分类阈值改变决策但不改变概率模型的 BCE', async ({ page }) => {
    const lab = await openLab(page, 'logistic-regression');
    // At w=b=0, p=1/2 for every label, so BCE is independently known: ln(2).
    expect(Number(await lab.getByTestId('ml-train-loss').textContent())).toBeCloseTo(Math.log(2), 4);
    await lab.getByRole('slider', { name: '权重 w', exact: true }).fill('2');
    await lab.getByRole('slider', { name: '偏置 b', exact: true }).fill('0.3');
    const before = await lab.getByTestId('ml-validation-loss').textContent();
    await lab.getByRole('slider', { name: '正类决策阈值 τ', exact: true }).fill('0.1');
    const low = await lab.locator('.ml-confusion tbody').innerText();
    await lab.getByRole('slider', { name: '正类决策阈值 τ', exact: true }).fill('0.9');
    await expect(lab.getByTestId('ml-validation-loss')).toHaveText(before!);
    expect(await lab.locator('.ml-confusion tbody').innerText()).not.toBe(low);
    await expect(lab.locator('.ml-boundary-note')).toContainText('边界');
  });

  test('反向传播的三步与有限差分表使用当前数值并持久化', async ({ page }) => {
    const lab = await openLab(page, 'backprop');
    await lab.getByRole('slider', { name: '输入 x', exact: true }).fill('2');
    await lab.getByRole('slider', { name: '权重 w', exact: true }).fill('0.5');
    await lab.getByRole('slider', { name: '偏置 b', exact: true }).fill('1');
    // z=(wx+b)^2=(.5*2+1)^2=4; dz/dw=2*(wx+b)*x=8.
    await expect(lab.locator('.nn-table-wrap tbody tr').nth(0).locator('td').nth(1)).toHaveText('8');
    await expect(lab.locator('.nn-table-wrap tbody tr').nth(0).locator('td').nth(2)).toHaveText('8');
    await lab.getByRole('button', { name: '反传一步', exact: true }).click();
    await expect(lab.locator('.nn-status')).toContainText('平方节点');
    await lab.getByRole('button', { name: '反传一步', exact: true }).click();
    await expect(lab.locator('.nn-status')).toContainText('∂z/∂b = 4');
    await lab.getByRole('button', { name: '反传一步', exact: true }).click();
    await expect(lab.locator('.nn-status')).toContainText('∂z/∂w = x × 2u = 8');
    await expect(lab.getByRole('button', { name: '反传一步', exact: true })).toBeDisabled();
    await expect(page.locator('.autosave')).toContainText('已本地保存');
    await page.reload();
    await expect(page.getByRole('slider', { name: '权重 w', exact: true })).toHaveValue('0.5');
    await expect(page.locator('.nn-status')).toContainText('∂z/∂w = x × 2u = 8');
  });

  test('因果注意力未来格严格为零；解除掩码和改变缩放后真实重算', async ({ page }) => {
    const lab = await openLab(page, 'causal-mask');
    const matrix = lab.locator('.tf-matrix').filter({ has: page.locator('.tf-matrix-heading strong').filter({ hasText: '头 1 的实时注意力权重' }) });
    const firstRow = matrix.locator('tbody tr').nth(0);
    await expect(firstRow.locator('td').nth(0)).toHaveText('1');
    for (let i = 1; i < 4; i++) await expect(firstRow.locator('td').nth(i)).toContainText('屏蔽');
    await lab.getByLabel('Transformer 信息流', { exact: true }).selectOption('0');
    await lab.getByLabel('因果掩码（未来严格为零）', { exact: true }).uncheck();
    await expect(matrix.locator('.tf-masked')).toHaveCount(0);
    const values = await firstRow.locator('td').allTextContents();
    expect(values.map(Number).every(value => value > 0)).toBe(true);
    expect(values.reduce((sum, value) => sum + Number(value), 0)).toBeCloseTo(1, 3);
    await lab.getByRole('slider', { name: 'Softmax 前缩放除数', exact: true }).fill('2');
    expect(await firstRow.locator('td').allTextContents()).not.toEqual(values);
    await expect(lab.locator('.tf-result')).toContainText('行和 = 1');
    await expect(page.locator('.autosave')).toContainText('已本地保存');
    await page.reload();
    await expect(page.getByRole('slider', { name: 'Softmax 前缩放除数', exact: true })).toHaveValue('2');
    await expect(page.getByLabel('因果掩码（未来严格为零）', { exact: true })).not.toBeChecked();
  });

  test('GPT top-k=1 的逐 token 生成可重现，解码参数不改变原模型损失', async ({ page }) => {
    const lab = await openLab(page, 'top-k-p');
    const originalLoss = await lab.getByTestId('gpt-loss').textContent();
    await lab.getByRole('slider', { name: 'GPT Top-k', exact: true }).fill('1');
    await lab.getByRole('slider', { name: 'GPT 温度', exact: true }).fill('0.5');
    await lab.getByRole('slider', { name: 'GPT Top-p', exact: true }).fill('0.9');
    await expect(lab.getByTestId('gpt-probability-sum')).toContainText('Σ q = 1.000000 · 保留 1/8');
    await expect(lab.getByTestId('gpt-loss')).toHaveText(originalLoss!);
    await lab.getByRole('button', { name: '生成一步', exact: true }).click();
    await expect(lab.getByTestId('gpt-generated')).toHaveText('吹');
    await lab.getByRole('button', { name: '生成一步', exact: true }).click();
    await expect(lab.getByTestId('gpt-generated')).toHaveText('吹过');
    await lab.getByRole('button', { name: '重置序列与随机步数', exact: true }).click();
    await lab.getByRole('button', { name: '生成一步', exact: true }).click();
    await expect(lab.getByTestId('gpt-generated')).toHaveText('吹');
    await expect(page.locator('.autosave')).toContainText('已本地保存');
    await page.reload();
    await expect(page.getByRole('slider', { name: 'GPT Top-k', exact: true })).toHaveValue('1');
    await expect(page.getByRole('slider', { name: 'GPT 温度', exact: true })).toHaveValue('0.5');
    await page.getByRole('button', { name: '生成一步', exact: true }).click();
    await expect(page.getByTestId('gpt-generated')).toHaveText('吹');
  });

  test('真实完整前缀与增量 KV 路径数值相等，操作计数符合独立求和', async ({ page }) => {
    const lab = await openLab(page, 'kv-cache');
    await lab.getByRole('slider', { name: '连续增量位置 T', exact: true }).fill('8');
    const metric = (label: string) => lab.locator('.modern-metric').filter({ has: page.locator('span').filter({ hasText: label }) }).locator('strong');
    await expect(metric('所有步最大输出绝对差')).toHaveText('0.00e+0');
    await expect(metric('完整 / 缓存 投影位置数')).toHaveText('36 / 8');
    await expect(metric('完整 / 缓存 分数点积次数')).toHaveText('120 / 36');
    await expect(lab.locator('tbody tr')).toHaveCount(8);
    await expect(page.locator('.autosave')).toContainText('已本地保存');
    await page.reload();
    await expect(page.getByRole('slider', { name: '连续增量位置 T', exact: true })).toHaveValue('8');
    await expect(page.locator('.modern-metric').first().locator('strong')).toHaveText('0.00e+0');
  });

  test('量化重建误差由七个元素计算，位数改变真实误差并持久化', async ({ page }) => {
    const lab = await openLab(page, 'quantization');
    await lab.getByRole('slider', { name: '权重位数 b', exact: true }).fill('2');
    await expect(lab.locator('.modern-metric').nth(0).locator('strong')).toHaveText('1.25000');
    const lowBits = Number(await lab.locator('.modern-metric').nth(1).locator('strong').textContent());
    // Independent seven-element arithmetic with qmax=1 and scale=1.25.
    expect(lowBits).toBeCloseTo((0.05 ** 2 + 0.6 ** 2 + 0.12 ** 2 + 0.05 ** 2 + 0.33 ** 2 + 0.45 ** 2) / 7, 6);
    await lab.getByRole('slider', { name: '权重位数 b', exact: true }).fill('8');
    expect(Number(await lab.locator('.modern-metric').nth(1).locator('strong').textContent())).toBeLessThan(lowBits / 100);
    await expect(page.locator('.autosave')).toContainText('已本地保存');
    await page.reload();
    await expect(page.getByRole('slider', { name: '权重位数 b', exact: true })).toHaveValue('8');
  });
});
