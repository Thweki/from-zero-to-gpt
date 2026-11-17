import {describe,expect,it,vi} from 'vitest';
import {buildTutorMessages,handleTutorRequest,validateTutorBody} from '../server/tutor';
import {emptyProgress,initialState,validateImport} from './storage';
import {validateTutorSelection} from './tutor-selection';

const input={lessonId:'functions',message:'请解释平方函数。',sessionId:'enum-contract-tests'};
const selection={kind:'text',title:'函数定义',text:'输入与输出的对应关系'};
const enumFields=[
  {field:'mode',values:['guide','hint','explain','review','solution']},
  {field:'readingMode',values:['intuition','math','code','deep']},
  {field:'difficulty',values:['beginner','standard','deep']},
] as const;
const malformedRequests=[
  ...enumFields.flatMap(({field,values})=>values.flatMap(value=>[
    {label:`${field} [${value}]`,patch:{[field]:[value]}},
    {label:`${field} [[${value}]]`,patch:{[field]:[[value]]}},
  ])),
  ...['user','assistant'].map(role=>({label:`history role [${role}]`,patch:{history:[{role:[role],content:'上一轮对话'}]}})),
  ...['text','image'].map(kind=>({label:`selection kind [${kind}]`,patch:{selection:{...selection,kind:[kind]}}})),
];

describe('tutor JSON enum contracts',()=>{
  it.each(malformedRequests)('rejects $label before calling a provider',async({patch})=>{
    const body={...input,...patch};
    expect(()=>validateTutorBody(body)).toThrow();
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'不应调用模型'}}]})));
    const request=new Request('https://learning.example/api/tutor/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
    });
    const response=await handleTutorRequest(request,{TUTOR_API_KEY:'synthetic-enum-test-key'},fetcher);
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(enumFields)('preserves every valid string for $field',({field,values})=>{
    for(const value of values)expect(validateTutorBody({...input,[field]:value})[field]).toBe(value);
  });

  it('keeps legacy defaults and only includes solutions for the literal solution mode',()=>{
    for(const value of [undefined,null]){
      expect(validateTutorBody({...input,mode:value,readingMode:value,difficulty:value})).toMatchObject({
        mode:'guide',readingMode:'intuition',difficulty:'beginner',
      });
    }
    for(const mode of enumFields[0].values){
      const system=buildTutorMessages(validateTutorBody({...input,mode}))[0].content;
      if(mode==='solution')expect(system).toContain('referenceImplementation');
      else expect(system).not.toContain('referenceImplementation');
    }
    const history=[{role:'user',content:'问题'},{role:'assistant',content:'解释'}];
    expect(buildTutorMessages(validateTutorBody({...input,history})).slice(1,-1)).toEqual(history);
  });

  it.each(['text','image'])('rejects array %s tags in draft and message selections on import',kind=>{
    // Image selections without a raster are valid captions, so only the tag is malformed.
    const valid={...selection,kind};
    expect(validateTutorSelection(valid)).toEqual(valid);
    for(const invalidKind of [[kind],[[kind]]]){
      const invalid={...valid,kind:invalidKind};
      expect(()=>validateTutorSelection(invalid)).toThrow();
      for(const selected of [
        {tutorSelection:invalid},
        {tutorMessages:[{role:'user',content:'解释',createdAt:'2026-01-01T00:00:00.000Z',selection:invalid}]},
      ]){
        const state={...initialState(),progress:{functions:{...emptyProgress(),...selected}}};
        expect(()=>validateImport(JSON.parse(JSON.stringify(state)))).toThrow();
      }
    }
  });
});
