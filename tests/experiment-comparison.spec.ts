import {test,expect} from '@playwright/test';

test('compare function experiments and restore the real controls and plotted result',async({page})=>{
  await page.goto('/#/lesson/functions');
  await page.getByRole('button',{name:'保存实验对照点',exact:true}).click();
  const comparison=page.getByRole('region',{name:'实验参数与结果对照'});
  await page.getByRole('slider',{name:'输入 x',exact:true}).fill('-3');
  await page.getByLabel('选择函数',{exact:true}).selectOption('1');
  const output=comparison.getByRole('row').filter({hasText:'函数的输出'});
  await expect(output.getByRole('cell')).toHaveText(['4','-5','-9']);
  await page.getByRole('button',{name:'恢复对照参数',exact:true}).click();
  await expect(page.getByRole('slider',{name:'输入 x',exact:true})).toHaveValue('2');
  await expect(page.getByLabel('选择函数',{exact:true})).toHaveValue('0');
  await expect(page.getByTestId('lab-result').getByRole('math')).toHaveAttribute('aria-label','f(2)=4');
  await expect(output.getByRole('cell')).toHaveText(['4','4','0']);
  await page.getByRole('tab',{name:'数学推导',exact:true}).click();
  await page.getByRole('tab',{name:'直觉理解',exact:true}).click();
  await expect(comparison.getByRole('table')).toHaveCount(0);
});

test('comparison fits a narrow viewport and reset leaves the comparison point intact',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/lesson/linear');
  await page.getByRole('slider',{name:'斜率 k',exact:true}).fill('2');
  await page.getByRole('button',{name:'保存实验对照点',exact:true}).click();
  await page.getByRole('button',{name:'重置实验参数',exact:true}).click();
  const comparison=page.getByRole('region',{name:'实验参数与结果对照'});
  await expect(comparison.getByRole('row').filter({hasText:'斜率 k'}).getByRole('cell')).toHaveText(['2','1','-1']);
  const bounds=await comparison.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'恢复对照参数',exact:true}).click();
  await expect(page.getByRole('slider',{name:'斜率 k',exact:true})).toHaveValue('2');
});
