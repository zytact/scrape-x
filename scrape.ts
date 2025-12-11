import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

interface Tweet {
    id: string | null;
    url: string | null;
    date: string | null;
    text: string;
}

async function scrape(
    username: string,
    maxTweets: number = 100
): Promise<void> {
    console.log(`Scraping @${username}`);

    const browser = await chromium.launch({
        headless: false, // IMPORTANT — tweets won't load headless
        args: [
            '--disable-blink-features=AutomationControlled',
            '--start-maximized',
        ],
    });

    const context = await browser.newContext({
        viewport: null,
        userAgent:
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    await page.addInitScript(() => {
        // Hide webdriver
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Always require login at start
    console.log('\n==========================================');
    console.log('PLEASE LOG IN TO TWITTER/X');
    console.log('==========================================');
    console.log('The browser will open to the login page.');
    console.log('After logging in, wait for your home feed to load.\n');

    // Navigate to Twitter login page
    await page.goto('https://x.com/i/flow/login', {
        waitUntil: 'domcontentloaded',
    });

    console.log('Waiting for you to complete login...');
    console.log('Once logged in, you should see your home feed.\n');

    // Wait for successful login by checking for home feed
    await page.waitForSelector('[data-testid="AppTabBar_Home_Link"]', {
        timeout: 300000, // 5 minutes to complete login
    });

    console.log('Login detected! Now navigating to profile...\n');

    // Now navigate to the target profile
    const url = `https://x.com/${username}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    console.log('Waiting for first tweet…');
    await page.waitForSelector('article[data-testid="tweet"]', {
        timeout: 60000,
    });

    console.log('Tweets are visible, starting scroll…');

    const tweets = new Set<string>();
    let staleScrollCount = 0;
    const maxStaleScrolls = 3; // Exit if no new tweets after 3 scrolls

    while (tweets.size < maxTweets) {
        const previousSize = tweets.size;

        const items = await page.$$eval('article[data-testid="tweet"]', (els) =>
            els.map((el) => {
                const time = el.querySelector('time');
                const text = el.querySelector('[data-testid="tweetText"]');

                return {
                    id:
                        time?.parentElement
                            ?.getAttribute('href')
                            ?.split('/')
                            .pop() ?? null,
                    url: time?.parentElement?.getAttribute('href') ?? null,
                    date: time?.getAttribute('datetime') ?? null,
                    text: text?.textContent ?? '',
                };
            })
        );

        items.forEach((t) => {
            if (t.id) tweets.add(JSON.stringify(t));
        });

        console.log(`Collected: ${tweets.size}`);

        // Check if we've collected new tweets
        if (tweets.size === previousSize) {
            staleScrollCount++;
            console.log(
                `No new tweets found (${staleScrollCount}/${maxStaleScrolls})`
            );

            if (staleScrollCount >= maxStaleScrolls) {
                console.log('Reached end of profile - no more tweets to load');
                break;
            }
        } else {
            staleScrollCount = 0; // Reset counter when new tweets are found
        }

        await page.mouse.wheel(0, 3000);
        await page.waitForTimeout(2000);
    }

    const arr: Tweet[] = [...tweets].map((x) => JSON.parse(x));
    const outputFile = `${username}_tweets.json`;
    writeFileSync(outputFile, JSON.stringify(arr, null, 2));

    console.log(`Saved ${arr.length} tweets to ${outputFile}`);
    await browser.close();
}

scrape('PurnimaaVats', 500);
