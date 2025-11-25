import { chromium } from "playwright";
import { writeFileSync } from "fs";

async function scrape(username, maxTweets = 100) {
  console.log(`Scraping @${username}`);

  const browser = await chromium.launch({
    headless: false, // IMPORTANT — tweets won't load headless
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
    ],
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    // Hide webdriver
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const url = `https://x.com/${username}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  console.log("Waiting for first tweet…");
  await page.waitForSelector('article[data-testid="tweet"]', {
    timeout: 60000,
  });

  console.log("Tweets are visible, starting scroll…");

  const tweets = new Set();

  while (tweets.size < maxTweets) {
    const items = await page.$$eval(
      'article[data-testid="tweet"]',
      (els) =>
        els.map((el) => {
          const time = el.querySelector("time");
          const text = el.querySelector('[data-testid="tweetText"]');

          return {
            id: time?.parentElement?.href?.split("/").pop() ?? null,
            url: time?.parentElement?.href ?? null,
            date: time?.getAttribute("datetime") ?? null,
            text: text?.innerText ?? "",
          };
        })
    );

    items.forEach((t) => {
      if (t.id) tweets.add(JSON.stringify(t));
    });

    console.log(`Collected: ${tweets.size}`);

    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(2000);
  }

  const arr = [...tweets].map((x) => JSON.parse(x));
  writeFileSync("tweets.json", JSON.stringify(arr, null, 2));

  console.log(`Saved ${arr.length} tweets to tweets.json`);
  await browser.close();
}

scrape("AdityaMandal_", 100);
