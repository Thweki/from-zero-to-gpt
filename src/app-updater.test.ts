import {describe,it,expect,vi} from 'vitest';
import {createAppUpdater} from './app-updater';
function fixture(){
 const update={version:'9.0.0',body:'Release notes',close:vi.fn(async()=>{}),download:vi.fn(async(cb:any)=>{cb({event:'Started',data:{contentLength:20}});cb({event:'Progress',data:{chunkLength:20}});}),install:vi.fn(async()=>{})};
 const restart=vi.fn(async()=>{}),check=vi.fn(async()=>update);return {update,restart,check,controller:createAppUpdater(check,restart)};
}
describe('signed update lifecycle',()=>{
 it('checks and downloads without installing until the user requests it',async()=>{
  const f=fixture();await f.controller.check();expect(f.controller.getSnapshot().phase).toBe('available');expect(f.update.download).not.toHaveBeenCalled();
  await f.controller.download();expect(f.controller.getSnapshot()).toMatchObject({phase:'ready',received:20,total:20});expect(f.update.install).not.toHaveBeenCalled();
  await f.controller.install();expect(f.update.install).toHaveBeenCalledOnce();expect(f.restart).toHaveBeenCalledOnce();
 });
 it('failed download or signature verification cannot trigger installation',async()=>{
  const f=fixture();f.update.download.mockRejectedValueOnce(new Error('invalid signature'));await f.controller.check();await f.controller.download();await f.controller.install();expect(f.controller.getSnapshot().phase).toBe('error');expect(f.update.install).not.toHaveBeenCalled();expect(f.restart).not.toHaveBeenCalled();
 });
 it('does not restart after a failed installation and reports a failed restart after successful installation',async()=>{
  const f=fixture();await f.controller.check();await f.controller.download();f.update.install.mockRejectedValueOnce(new Error('installer failed'));
  await f.controller.install();expect(f.controller.getSnapshot().phase).toBe('error');expect(f.restart).not.toHaveBeenCalled();
  const installed=fixture();await installed.controller.check();await installed.controller.download();installed.restart.mockRejectedValueOnce(new Error('restart failed'));
  await installed.controller.install();expect(installed.controller.getSnapshot()).toMatchObject({phase:'installed',error:expect.stringContaining('手动')});
 });
 it('distinguishes unavailable update feed from current version and deduplicates requests',async()=>{
  const check=vi.fn(async()=>{throw new Error('404');}),c=createAppUpdater(check,vi.fn());await Promise.all([c.check(),c.check()]);expect(check).toHaveBeenCalledOnce();expect(c.getSnapshot().phase).toBe('error');
  const current=createAppUpdater(async()=>null,vi.fn());await current.check();expect(current.getSnapshot().phase).toBe('latest');
 });
});
