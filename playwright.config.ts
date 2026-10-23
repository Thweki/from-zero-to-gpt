import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',timeout:60000,fullyParallel:false,workers:1,
  use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000},
  projects:[{name:'touch-chromium',testMatch:'usability-touch.spec.ts',use:{...devices['Pixel 7'],defaultBrowserType:'chromium'}},{name:'desktop',testIgnore:['mobile.spec.ts','usability-touch.spec.ts'],use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'mobile',testMatch:'mobile.spec.ts',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
});
