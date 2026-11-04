import {copyFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';

const target='src-tauri/gen/android/app/src/main/java/org/fromzerotogpt/learning/MainActivity.kt';
if(!process.env.ANDROID_HOME)throw new Error('ANDROID_HOME is required for Android builds');
mkdirSync(path.dirname(target),{recursive:true});
copyFileSync('native/android/MainActivity.kt',target);
