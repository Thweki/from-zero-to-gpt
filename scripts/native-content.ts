import {writeFileSync} from 'node:fs';
import {lessons} from '../src/data/lessons';

const output=process.argv[2];
if(!output)throw new Error('需要原生课程输出路径');
writeFileSync(output,JSON.stringify(lessons));
