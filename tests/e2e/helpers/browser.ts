import { chromium, Browser, BrowserContext } from "@playwright/test";

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

export async function getContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
