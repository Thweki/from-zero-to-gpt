import { handleTutorRequest } from './tutor';
import type { TutorEnvironment } from './tutor';
interface Environment extends TutorEnvironment { ASSETS:{fetch:(request:Request)=>Promise<Response>}; }
export default {async fetch(request:Request,env:Environment){
  if(new URL(request.url).pathname.startsWith('/api/tutor/'))return handleTutorRequest(request,env);
  return env.ASSETS.fetch(request);
}};
