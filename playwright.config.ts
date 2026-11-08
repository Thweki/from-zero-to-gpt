import { defineConfig, devices } from '@playwright/test';
const port=Number(process.env.PLAYWRIGHT_PORT||5173);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PLAYWRIGHT_PORT');
export default defineConfig({
  testDir:'./tests',timeout:60000,fullyParallel:false,workers:1,
  reporter:process.env.CI?[['list'],['json',{outputFile:'artifacts/playwright-results.json'}]]:'list',
  use:{baseURL:`http://127.0.0.1:${port}`,trace:'retain-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}},
  webServer:{command:`npm run dev -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:!process.env.CI,timeout:30000},
  projects:[{name:'touch-chromium',testMatch:'usability-touch.spec.ts',use:{...devices['Pixel 7'],defaultBrowserType:'chromium'}},{name:'desktop',testIgnore:['mobile.spec.ts','usability-touch.spec.ts'],use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'mobile',testMatch:'mobile.spec.ts',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
});
