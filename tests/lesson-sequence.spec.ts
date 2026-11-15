import {test,expect,type Page} from '@playwright/test';
import {lessons} from '../src/data/lessons';
import graph from '../src/data/knowledge-graph.json' with {type:'json'};

const navigation=(page:Page,position='顶部')=>page.getByRole('navigation',{name:`课程顺序 · ${position}`,exact:true});
async function atLessonStart(page:Page,title:string){
  const heading=page.getByRole('heading',{level:1});
  await expect(heading).toHaveText(title);
  await expect(heading).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
}

test('top navigation names the next lesson, supports keyboard activation and has no previous lesson at the start',async({page})=>{
  await page.goto(`/#/lesson/${lessons[0].id}`);
  const nav=navigation(page);
  await expect(nav.getByText('已是第一章')).toBeVisible();
  await expect(nav.getByRole('button',{name:/上一章/})).toHaveCount(0);
  const next=nav.getByRole('button',{name:`下一章 · ${lessons[1].number} ${lessons[1].title}`,exact:true});
  await next.focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`#/lesson/${lessons[1].id}$`));
  await atLessonStart(page,lessons[1].title);
});

for(const reducedMotion of ['reduce','no-preference'] as const)test(`${reducedMotion}: footer navigation starts at the top and preserves each lesson's mode and work`,async({page})=>{
  await page.emulateMedia({reducedMotion});
  await page.goto('/#/lesson/functions');
  await page.getByRole('slider',{name:'输入 x',exact:true}).fill('-2');
  await page.getByRole('tab',{name:'代码实现',exact:true}).click();
  await page.getByLabel('Python 代码编辑器').fill('draft = "keep my work"');
  await navigation(page,'底部').getByRole('button',{name:/下一章/}).click();
  await atLessonStart(page,lessons[1].title);
  await expect(page.getByRole('tab',{name:'直觉理解',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  await navigation(page,'底部').getByRole('button',{name:/上一章/}).click();
  await atLessonStart(page,lessons[0].title);
  await expect(page.getByLabel('Python 代码编辑器')).toHaveValue('draft = "keep my work"');
  await expect(page.getByRole('tab',{name:'代码实现',exact:true})).toHaveAttribute('aria-selected','true');
  const evidence=page.getByRole('region',{name:'本章学习记录'});
  await expect(evidence).toContainText('未记录');
  await expect(evidence).toContainText('待验证');
  await expect(evidence).toContainText('未验证');
  await expect(evidence).toContainText('尚未自评');
  await page.getByRole('tab',{name:'直觉理解',exact:true}).click();
  await expect(page.getByRole('slider',{name:'输入 x',exact:true})).toHaveValue('-2');
  await navigation(page).getByRole('button',{name:/下一章/}).click();
  await atLessonStart(page,lessons[1].title);
  await expect(page.getByRole('tab',{name:'数学推导',exact:true})).toHaveAttribute('aria-selected','true');
  await page.goBack();
  await expect(page.getByRole('heading',{level:1})).toHaveText(lessons[0].title);
  await page.goForward();
  await expect(page.getByRole('heading',{level:1})).toHaveText(lessons[1].title);
});

test('sequential navigation crosses stage boundaries in both directions',async({page})=>{
  const index=graph.nodes.findIndex(node=>node.stage===2);
  const previous=lessons[index-1],next=lessons[index];
  await page.goto(`/#/lesson/${previous.id}`);
  await navigation(page).getByRole('button',{name:`下一章 · ${next.number} ${next.title}`,exact:true}).click();
  await atLessonStart(page,next.title);
  await expect(page.locator('.lesson-kicker')).toContainText('阶段 02');
  await navigation(page).getByRole('button',{name:`上一章 · ${previous.number} ${previous.title}`,exact:true}).click();
  await atLessonStart(page,previous.title);
  await expect(page.locator('.lesson-kicker')).toContainText('阶段 01');
});

test('narrow screens show both destinations and the last lesson returns to the roadmap without wrapping',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  const last=lessons.at(-1)!,previous=lessons.at(-2)!;
  await page.goto(`/#/lesson/${last.id}`);
  for(const position of ['顶部','底部']){
    const nav=navigation(page,position);
    await expect(nav.getByRole('button',{name:/下一章/})).toHaveCount(0);
    const prev=nav.getByRole('button',{name:`上一章 · ${previous.number} ${previous.title}`,exact:true});
    await expect(prev).toBeVisible();
    for(const control of [prev,nav.getByRole('link',{name:'回到学习路线',exact:true})]){
      const box=(await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(320);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await navigation(page,'底部').getByRole('link',{name:'回到学习路线',exact:true}).click();
  await expect(page).toHaveURL(/#\/map$/);
});
