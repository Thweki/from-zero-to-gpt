import { expect, test, type Page, type Request, type Route } from '@playwright/test';

/** These are deliberately mocked UI/HTTP transport tests. They do not contact a
 * model provider or verify model reasoning, pedagogy, credentials or availability.
 * Provider-backed integration is verified separately by the real adapter tests. */
const mockStatus = { configured: true, provider: 'UI transport mock', model: 'mock-model', baseURL: 'https://mock.invalid/v1', accessCodeRequired: false };
const isChat = (request: Request) => new URL(request.url()).pathname === '/api/tutor/chat' && request.method() === 'POST';
const panel = (page: Page) => page.locator('.tutor-page').getByRole('region', { name: 'AI 导师对话', exact: true });

async function mockTutor(page: Page, handler?: (route: Route) => Promise<void>, configured = true) {
  await page.route('**/api/tutor/status', route => route.fulfill({ json: { ...mockStatus, configured } }));
  await page.route('**/api/tutor/chat', handler ?? (route => route.fulfill({ json: { answer: '模拟回答：先检查输入与输出的对应关系，再试一个负数。' } })));
}

async function ask(page: Page, question: string) {
  await panel(page).getByLabel('向 AI 导师提问', { exact: true }).fill(question);
  const request = page.waitForRequest(isChat);
  await panel(page).getByRole('button', { name: '发送', exact: true }).click();
  return await request;
}

async function savedDraft(page: Page, lessonId: string) {
  return page.evaluate(id => new Promise<string | undefined>((resolve, reject) => {
    const opening = indexedDB.open('from-zero-to-gpt', 1);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const request = db.transaction('learning', 'readonly').objectStore('learning').get('state');
      request.onerror = () => { db.close(); reject(request.error); };
      request.onsuccess = () => { db.close(); resolve(request.result?.progress?.[id]?.tutorDraft); };
    };
  }), lessonId);
}

test.describe('AI 导师 UI/HTTP transport — deliberately mocked, no provider calls', () => {
  test('默认不传代码/笔记，主动勾选分享才添加当前内容', async ({ page }) => {
    await mockTutor(page);
    const code = '# private-code-marker\ndef square(x):\n    return x * x\n';
    const note = 'private-note-marker：我想先自己试。';
    await page.goto('/#/lesson/functions');
    await page.getByRole('tab', { name: '代码实现', exact: true }).click();
    await page.getByLabel('Python 代码编辑器').fill(code);
    await page.getByLabel('当前章节随手笔记').fill(note);
    await page.getByRole('link', { name: '打开 AI 导师', exact: true }).click();
    const tutor = panel(page);
    await expect(tutor.locator('.tutor-model')).toContainText('UI transport mock');
    await expect(tutor.locator('.tutor-scope')).toContainText('函数是什么');
    await expect(tutor.getByRole('button', { name: '给我提示', exact: true })).toHaveAttribute('aria-pressed', 'true');

    const first = await ask(page, '我该从哪个输入开始检查？');
    const body = first.postDataJSON();
    expect(body).toMatchObject({ lessonId: 'functions', mode: 'hint', shareCode: false, shareNote: false, history: [] });
    for (const key of ['code', 'note', 'error']) expect(body).not.toHaveProperty(key);
    expect(first.postData()).not.toContain('private-code-marker');
    expect(first.postData()).not.toContain('private-note-marker');
    expect(first.headers()).not.toHaveProperty('authorization');
    await expect(tutor.locator('.tutor-message.assistant')).toHaveCount(1);

    await tutor.getByRole('button', { name: '上下文与难度', exact: true }).click();
    await tutor.getByLabel('分享当前代码和最近错误', { exact: true }).check();
    await tutor.getByLabel('分享当前章节笔记', { exact: true }).check();
    const shared = (await ask(page, '现在请结合我主动分享的尝试给一个提示。')).postDataJSON();
    expect(shared).toMatchObject({ shareCode: true, shareNote: true, code, note });
    expect(shared.error).toBe('');
    expect(shared.history.map((message: { role: string }) => message.role)).toEqual(['user', 'assistant']);
    await expect(tutor.locator('.tutor-message.assistant')).toHaveCount(2);

    await tutor.getByLabel('分享当前代码和最近错误', { exact: true }).uncheck();
    await tutor.getByLabel('分享当前章节笔记', { exact: true }).uncheck();
    const privateAgain = (await ask(page, '这次只发送问题。')).postDataJSON();
    expect(privateAgain.shareCode).toBe(false);
    expect(privateAgain.shareNote).toBe(false);
    for (const key of ['code', 'note', 'error']) expect(privateAgain).not.toHaveProperty(key);
  });

  test('文本索要答案不改变默认 hint；只有显式完整解答按钮选择 solution', async ({ page }) => {
    await mockTutor(page, route => route.fulfill({ json: { answer: '模拟模式响应：检查页面发送的 mode，不据此评价模型回答质量。' } }));
    await page.goto('/#/tutor');
    const tutor = panel(page);
    await expect(tutor.locator('.tutor-model')).toContainText('mock-model');
    expect((await ask(page, '直接给我完整答案和所有代码。')).postDataJSON().mode).toBe('hint');
    await expect(tutor.locator('.tutor-message.assistant')).toHaveCount(1);
    await tutor.getByRole('button', { name: '完整解答', exact: true }).click();
    await expect(tutor.getByRole('button', { name: '完整解答', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tutor.locator('.solution-note')).toContainText('主动选择完整解答');
    await tutor.getByRole('button', { name: '上下文与难度', exact: true }).click();
    await tutor.getByLabel('导师解释难度', { exact: true }).selectOption('deep');
    const solution = (await ask(page, '我已经尝试过，请逐步解释完整解答。')).postDataJSON();
    expect(solution).toMatchObject({ mode: 'solution', difficulty: 'deep', shareCode: false, shareNote: false });
    await expect(tutor.locator('.tutor-message.assistant')).toHaveCount(2);
    await tutor.getByRole('button', { name: '给我提示', exact: true }).click();
    await expect(tutor.locator('.solution-note')).toHaveCount(0);
    expect((await ask(page, '下一步只给一个小提示。')).postDataJSON().mode).toBe('hint');
  });

  test('服务错误保留用户问题；重试发送同一问题且不重复添加消息', async ({ page }) => {
    const bodies: unknown[] = [];
    await mockTutor(page, async route => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill(bodies.length === 1 ? { status: 503, json: { error: '模拟服务暂时不可用，请稍后重试。' } } : { json: { answer: '模拟重试成功：先检查 return。' } });
    });
    await page.goto('/#/tutor');
    const tutor = panel(page);
    const question = '为什么打印了结果却返回 None？';
    await ask(page, question);
    await expect(tutor.getByRole('alert')).toContainText('模拟服务暂时不可用');
    await expect(tutor.locator('.tutor-message.user')).toHaveCount(1);
    await expect(tutor.locator('.tutor-message.user')).toContainText(question);
    await expect(tutor.getByLabel('向 AI 导师提问')).toHaveValue('');
    const nextDraft = '尚未发送的新问题：我还想比较 print 与 return。';
    await tutor.getByLabel('向 AI 导师提问').fill(nextDraft);
    await expect.poll(() => savedDraft(page, 'functions')).toBe(nextDraft);
    await tutor.getByRole('button', { name: '重试上次问题', exact: true }).click();
    await expect(tutor.locator('.tutor-message.assistant')).toContainText('模拟重试成功');
    await expect(tutor.getByRole('alert')).toHaveCount(0);
    await expect(tutor.locator('.tutor-message.user')).toHaveCount(1);
    await expect(tutor.getByLabel('向 AI 导师提问')).toHaveValue(nextDraft);
    await expect.poll(() => savedDraft(page, 'functions')).toBe(nextDraft);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toMatchObject({ message: question, history: [], mode: 'hint' });
  });

  test('停止中止待完成 HTTP 请求，保留问题并可重试，不插入过期回答', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let requests = 0;
    await mockTutor(page, async route => {
      requests++;
      if (requests === 1) {
        await gate;
        await route.fulfill({ json: { answer: '这条已停止请求的过期模拟回答不应显示。' } }).catch(() => {});
      } else await route.fulfill({ json: { answer: '停止后重试成功的模拟回答。' } });
    });
    try {
      await page.goto('/#/tutor');
      const tutor = panel(page);
      await ask(page, '我想检查停止按钮。');
      await expect(tutor.locator('.tutor-pending')).toBeVisible();
      const aborted = page.waitForEvent('requestfailed', { predicate: isChat });
      await tutor.getByRole('button', { name: '停止', exact: true }).click();
      await expect(tutor.getByRole('alert')).toContainText('已停止回复');
      await expect(tutor.locator('.tutor-message.assistant')).toHaveCount(0);
      await expect(tutor.locator('.tutor-message.user')).toHaveCount(1);
      release();
      await aborted;
      await tutor.getByRole('button', { name: '重试上次问题', exact: true }).click();
      await expect(tutor.locator('.tutor-message.assistant')).toHaveCount(1);
      await expect(tutor.locator('.tutor-message.assistant')).toContainText('停止后重试成功');
      await expect(tutor.getByRole('log')).not.toContainText('过期模拟回答');
    } finally { release(); }
  });

  test('对话与未发送草稿按章节保存，刷新及章节切换后恢复', async ({ page }) => {
    await mockTutor(page);
    await page.goto('/#/tutor');
    const tutor = panel(page);
    const question = '持久化问题：平方函数为何对称？';
    const draft = '未发送草稿：接下来我要比较 −2 和 2。';
    await ask(page, question);
    await expect(tutor.locator('.tutor-message.assistant')).toHaveCount(1);
    await tutor.getByLabel('向 AI 导师提问').fill(draft);
    await expect.poll(() => savedDraft(page, 'functions')).toBe(draft);
    await page.reload();
    await expect(panel(page).getByRole('log')).toContainText(question);
    await expect(panel(page).locator('.tutor-message.assistant')).toHaveCount(1);
    await expect(panel(page).getByLabel('向 AI 导师提问')).toHaveValue(draft);

    await page.getByLabel('导师关联章节', { exact: true }).selectOption('linear');
    await expect(panel(page).locator('.tutor-scope')).toContainText('线性函数与参数');
    await expect(panel(page).getByLabel('向 AI 导师提问')).toHaveValue('');
    await expect(panel(page).getByRole('log')).not.toContainText(question);
    const otherDraft = '直线草稿：截距怎样改变图像？';
    await panel(page).getByLabel('向 AI 导师提问').fill(otherDraft);
    await expect.poll(() => savedDraft(page, 'linear')).toBe(otherDraft);
    await page.reload();
    await expect(page.getByLabel('导师关联章节')).toHaveValue('linear');
    await expect(panel(page).getByLabel('向 AI 导师提问')).toHaveValue(otherDraft);
    await page.getByLabel('导师关联章节').selectOption('functions');
    await expect(panel(page).getByRole('log')).toContainText(question);
    await expect(panel(page).getByLabel('向 AI 导师提问')).toHaveValue(draft);
  });

  test('未配置模型时说明连接方式并禁用发送，教材与数学实验继续可用', async ({ page }) => {
    let chats = 0;
    await mockTutor(page, async route => { chats++; await route.fulfill({ json: { answer: '不应请求' } }); }, false);
    await page.goto('/#/tutor');
    const tutor = panel(page);
    await expect(tutor.locator('.tutor-unavailable')).toContainText('服务端尚未配置模型密钥');
    await expect(tutor.getByRole('link', { name: '查看模型连接说明' })).toHaveAttribute('href', '#/settings');
    await tutor.getByLabel('向 AI 导师提问').fill('可以先保留草稿，但不应发送。');
    await expect(tutor.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    for (const button of await tutor.locator('.tutor-quick button').all()) await expect(button).toBeDisabled();
    await page.goto('/#/lesson/functions');
    await page.getByRole('slider', { name: '输入 x', exact: true }).fill('-2');
    await expect(page.getByTestId('lab-result')).toHaveText('f(-2) = 4');
    expect(chats).toBe(0);
  });

  test('连接状态请求失败时给出说明，重新检查恢复可发送状态', async ({ page }) => {
    let online = false;
    await mockTutor(page);
    await page.route('**/api/tutor/status', async route => {
      // Keep the simulated outage active through development StrictMode's
      // repeated mount effects; only the explicit user retry restores service.
      if (!online) await route.abort('internetdisconnected');
      else await route.fulfill({ json: mockStatus });
    });
    await page.goto('/#/tutor');
    const tutor = panel(page);
    await expect(tutor.locator('.tutor-unavailable')).toContainText('无法连接导师后端');
    await tutor.getByLabel('向 AI 导师提问').fill('连接恢复后继续。');
    await expect(tutor.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    online = true;
    await tutor.getByRole('button', { name: '检查', exact: true }).click();
    await expect(tutor.locator('.tutor-model')).toContainText('UI transport mock');
    await expect(tutor.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
    await expect(tutor.locator('.tutor-unavailable')).toHaveCount(0);
  });
});
