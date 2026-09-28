const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  try {
    await page.goto('https://frabjous-croissant-f21189.netlify.app/upload/1786410481795/g1786410676491/3', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch(e) {
    console.log('Timeout or error:', e.message);
  }
  
  await browser.close();
})();
