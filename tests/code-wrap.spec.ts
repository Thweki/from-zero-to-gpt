import {test,expect} from '@playwright/test';
import {expectNoPageOverflow} from './layout-helpers';

for(const width of [1440,390,320])test(`${width}px: code wrap fits long lines and preserves editing and saved source`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.goto('/#/lesson/functions');
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Python 代码编辑器'});
  const toggle=page.getByRole('button',{name:'自动换行',exact:true});
  const code='def square(x):\n    # '+ '中文 comment '.repeat(30)+'\n    value = "'+'x'.repeat(400)+'"\n    return x * x\n';
  await editor.fill(code);
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(editor).toHaveAttribute('wrap','off');
  expect(await editor.evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(true);
  await editor.evaluate((n:HTMLTextAreaElement)=>n.setSelectionRange(4,18,'backward'));
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(editor).toHaveAttribute('wrap','soft');
  await expect(page.locator('.line-numbers')).toHaveCount(0);
  await expect(editor).toHaveValue(code);
  expect(await editor.evaluate((n:HTMLTextAreaElement)=>[n.selectionStart,n.selectionEnd,n.selectionDirection])).toEqual([4,18,'backward']);
  expect(await editor.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  await expectNoPageOverflow(page);
  // Resize while wrapped: both whitespace and unbroken tokens must still fit.
  await page.setViewportSize({width:width===320?390:320,height:1000});
  expect(await editor.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  await editor.focus();await editor.press('Control+End');await editor.press('Control+]');
  await expect(editor).toHaveValue(code+'    ');
  await toggle.focus();await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(editor).toHaveAttribute('wrap','off');
  await expect(page.locator('.line-numbers > div')).toHaveCount(5);
  expect(await editor.evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(true);
  await toggle.press('Enter');await expect(toggle).toHaveAttribute('aria-pressed','true');
  // Returning to the lab starts unwrapped; the stored source has no soft breaks.
  await page.getByRole('tab',{name:'深入研究',exact:true}).click();
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(editor).toHaveValue(code+'    ');
});
