import { readdirSync, readFileSync } from "fs";
import { join } from "path";

interface Tweet {
  id: string | null;
  url: string | null;
  date: string;
  text: string;
}

interface TweetWithParsedDate extends Tweet {
  parsedDate: Date;
}

interface TweetsByDay {
  [key: string]: number;
}

function analyzeTweetFrequency(): void {
  // Find all files ending with _tweets.json
  const files = readdirSync(".")
    .filter((f) => f.endsWith("_tweets.json"));

  if (files.length === 0) {
    console.log("No *_tweets.json files found in the current directory.");
    return;
  }

  console.log(`Found ${files.length} tweet file(s)\n`);

  files.forEach((file) => {
    const username = file.replace("_tweets.json", "");
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 Analysis for @${username}`);
    console.log("=".repeat(60));

    try {
      const data: Tweet[] = JSON.parse(readFileSync(file, "utf-8"));

      if (!data || data.length === 0) {
        console.log("No tweets found in this file.\n");
        return;
      }

      // Parse dates and sort chronologically
      const tweets: TweetWithParsedDate[] = data
        .map((t) => ({
          ...t,
          parsedDate: new Date(t.date),
        }))
        .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

      const totalTweets = tweets.length;
      const firstTweet = tweets[0].parsedDate;
      const lastTweet = tweets[tweets.length - 1].parsedDate;

      // Calculate date range in days
      const daysDiff = Math.ceil(
        (lastTweet.getTime() - firstTweet.getTime()) / (1000 * 60 * 60 * 24)
      );
      const actualDays = daysDiff === 0 ? 1 : daysDiff;

      // Calculate average tweets per day
      const avgTweetsPerDay = totalTweets / actualDays;

      // Count tweets per day to find maximum
      const tweetsByDay: TweetsByDay = {};
      tweets.forEach((tweet) => {
        const dateKey = tweet.parsedDate.toISOString().split("T")[0];
        tweetsByDay[dateKey] = (tweetsByDay[dateKey] || 0) + 1;
      });

      const maxTweetsInDay = Math.max(...Object.values(tweetsByDay));
      const maxTweetDate = Object.keys(tweetsByDay).find(
        (date) => tweetsByDay[date] === maxTweetsInDay
      );

      // Display results
      console.log(`\nTotal tweets: ${totalTweets}`);
      console.log(`Date range: ${firstTweet.toISOString().split("T")[0]} to ${lastTweet.toISOString().split("T")[0]}`);
      console.log(`Period: ${actualDays} day(s)`);

      // Format average frequency
      console.log(`\nAverage frequency:`);
      if (avgTweetsPerDay >= 1) {
        console.log(`  ${avgTweetsPerDay.toFixed(2)} tweets per day`);
      } else {
        // Calculate days per tweet
        const daysPerTweet = Math.round(1 / avgTweetsPerDay);
        console.log(`  1 tweet in ${daysPerTweet} days`);
      }

      console.log(`\nMaximum in a single day:`);
      console.log(`  ${maxTweetsInDay} tweets on ${maxTweetDate}`);

      // Additional stats
      const activeDays = Object.keys(tweetsByDay).length;
      console.log(`\nActive days: ${activeDays} out of ${actualDays} days (${((activeDays / actualDays) * 100).toFixed(1)}%)`);

    } catch (error) {
      console.error(`Error processing ${file}:`, (error as Error).message);
    }
  });

  console.log(`\n${"=".repeat(60)}\n`);
}

analyzeTweetFrequency();
