import {describe,expect,it} from 'vitest';
import {tutorApiUrl} from './runtime';

describe('独立应用的导师服务地址',()=>{
  it('浏览器始终使用同源 API',()=>{
    expect(tutorApiUrl('status',false,'https://unused.example')).toBe('/api/tutor/status');
  });
  it('独立应用默认不发出请求，只接受显式 HTTPS 源',()=>{
    expect(tutorApiUrl('chat',true)).toBeNull();
    expect(tutorApiUrl('chat',true,'https://tutor.example')).toBe('https://tutor.example/api/tutor/chat');
  });
  it.each(['http://localhost:8787','https://user:secret@example.com','https://example.com/path','https://example.com?query=1','not-a-url'])('拒绝不安全或含额外组件的地址 %s',origin=>{
    expect(tutorApiUrl('status',true,origin)).toBeNull();
  });
});
