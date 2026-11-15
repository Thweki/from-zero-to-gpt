import {test,expect} from '@playwright/test';
import {lessonById} from '../src/data/lessons';
import {practiceLessons} from '../src/practice-quiz';

test('practice supports keyboard answers, retries and download without changing saved evidence',async({page})=>{
  await page.goto('/#/lesson/linear');
  const quiz=page.getByRole('region',{name:'随堂小测'});
  await expect(quiz).toBeVisible();
  // Establish a saved official quiz result first.
  await page.locator(`.quiz-options input[value="${lessonById.linear.quiz.correct}"]`).check();
  await page.getByRole('button',{name:'检查我的理解'}).click();
  await expect(page.locator('.quiz-card .badge')).toContainText('已验证');
  const start=quiz.getByRole('button',{name:/开始小测/});
  await start.focus();await page.keyboard.press('Enter');
  await expect(quiz.getByRole('heading',{name:'随堂小测'})).toBeFocused();
  const submit=quiz.getByRole('button',{name:'提交本轮小测'});
  await expect(submit).toBeDisabled();
  const questions=practiceLessons(lessonById.linear);
  for(const [index,lesson] of questions.entries()){
    const choice=index===0?(lesson.quiz.correct+1)%4:lesson.quiz.correct;
    const radio=quiz.locator(`input[name="practice-${lesson.id}"][value="${choice}"]`);
    await radio.focus();await page.keyboard.press('Space');
  }
  await page.getByRole('tab',{name:'数学推导'}).click();
  await expect(quiz.locator('input:checked')).toHaveCount(questions.length);
  await submit.click();
  await expect(quiz.getByRole('heading',{name:'本轮结果'})).toBeFocused();
  await expect(quiz.getByRole('status')).toContainText(`本轮答对 ${questions.length-1} / ${questions.length}`);
  const downloading=page.waitForEvent('download');
  await quiz.getByRole('button',{name:'下载本轮结果（JSON）'}).click();
  expect((await downloading).suggestedFilename()).toBe('practice-linear.json');
  await quiz.getByRole('button',{name:'只重做错题'}).click();
  await expect(quiz.getByRole('group')).toHaveCount(1);
  await expect(quiz.locator('input:checked')).toHaveCount(0);
  await quiz.locator(`input[value="${lessonById.linear.quiz.correct}"]`).check();
  await submit.click();
  await expect(quiz.getByRole('status')).toContainText('本轮答对 1 / 1');
  await page.reload();
  await expect(start).toBeVisible();
  await page.getByRole('tab',{name:'直觉理解'}).click();
  await expect(page.locator('.quiz-card .badge')).toContainText('已验证');
  await expect(page.locator(`.quiz-options input[value="${lessonById.linear.quiz.correct}"]`)).toBeChecked();
});

test('practice fits a narrow viewport and clears abandoned answers after changing chapters',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/lesson/linear');
  const quiz=page.getByRole('region',{name:'随堂小测'});
  await quiz.getByRole('button',{name:/开始小测/}).click();
  await quiz.getByRole('radio').first().check();
  expect(await quiz.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await quiz.getByRole('button',{name:'结束并清除本轮'}).click();
  await expect(quiz.getByRole('button',{name:/开始小测/})).toBeFocused();
  await quiz.getByRole('button',{name:/开始小测/}).click();
  await expect(quiz.locator('input:checked')).toHaveCount(0);
  await page.goto('/#/lesson/functions');
  await expect(quiz.getByRole('button',{name:/开始小测/})).toBeVisible();
});
