import { readdirSync, readFileSync } from "fs";

interface Tweet {
  id: string | null;
  url: string | null;
  date: string | null;
  text: string;
}

interface TweetWithParsedDate extends Tweet {
  parsedDate: Date;
}

interface FrequencyData {
  username: string;
  totalTweets: number;
  byMonth: Record<string, number>;
  byDayOfWeek: Record<string, number>;
  byHour: Record<number, number>;
  avgTweetsPerDay: number;
  stdDevTweetsPerDay: number;
  avgGapBetweenTweets: number;
  stdDevGap: number;
  burstIndex: number;
}

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

function categorizeConsistency(stdDev: number): { category: string; color: string } {
  if (stdDev >= 0.7) {
    return { category: "Highly bursty / unpredictable", color: colors.red };
  } else if (stdDev >= 0.5) {
    return { category: "Somewhat irregular", color: colors.yellow };
  } else {
    return { category: "Very consistent", color: colors.green };
  }
}

function getHeatmapColor(count: number, max: number): string {
  if (count === 0) return "\x1b[48;5;235m"; // Dark gray background
  const intensity = count / max;
  if (intensity >= 0.75) return "\x1b[48;5;196m"; // Bright red
  if (intensity >= 0.50) return "\x1b[48;5;208m"; // Orange
  if (intensity >= 0.25) return "\x1b[48;5;226m"; // Yellow
  return "\x1b[48;5;46m"; // Green
}

function renderGitHubStyleHeatmap(validTweets: TweetWithParsedDate[]): void {
  if (validTweets.length === 0) return;

  // Find date range
  const dates = validTweets.map(t => t.parsedDate.getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  
  // Start from the Sunday before the earliest tweet
  const startDate = new Date(minDate);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  startDate.setHours(0, 0, 0, 0);
  
  // End on the Saturday after the latest tweet
  const endDate = new Date(maxDate);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  endDate.setHours(23, 59, 59, 999);
  
  // Build a map of date -> tweet count
  const tweetsByDate: Record<string, number> = {};
  for (const tweet of validTweets) {
    const dateKey = tweet.parsedDate.toISOString().split("T")[0];
    tweetsByDate[dateKey] = (tweetsByDate[dateKey] || 0) + 1;
  }
  
  // Calculate number of weeks
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const weeks = Math.ceil(totalDays / 7);
  
  // Create 2D array: [week][dayOfWeek]
  const grid: number[][] = Array.from({ length: weeks }, () => Array(7).fill(0));
  
  let currentDate = new Date(startDate);
  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const dateKey = currentDate.toISOString().split("T")[0];
      grid[week][day] = tweetsByDate[dateKey] || 0;
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  // Find max for color scaling
  const maxCount = Math.max(...Object.values(tweetsByDate), 1);
  
  console.log(`   ${colors.blue}Activity Heatmap (GitHub-style):${colors.reset}`);
  console.log(`   ${colors.bright}${minDate.toISOString().split("T")[0]} → ${maxDate.toISOString().split("T")[0]}${colors.reset}`);
  console.log();
  
  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  
  // Render grid (rows = days of week, columns = weeks)
  for (let day = 0; day < 7; day++) {
    process.stdout.write(`   ${dayLabels[day].padEnd(3)} `);
    for (let week = 0; week < weeks; week++) {
      const count = grid[week][day];
      const color = getHeatmapColor(count, maxCount);
      process.stdout.write(`${color} ${colors.reset}`);
    }
    process.stdout.write("\n");
  }
  
  console.log();
  console.log(`   ${colors.bright}Legend:${colors.reset} \x1b[48;5;235m ${colors.reset} 0  \x1b[48;5;46m ${colors.reset} 1-25%  \x1b[48;5;226m ${colors.reset} 25-50%  \x1b[48;5;208m ${colors.reset} 50-75%  \x1b[48;5;196m ${colors.reset} 75-100%`);
}

function analyzeTweetFrequency(): void {
  // Find all *_tweets.json files
  const files = readdirSync(".")
    .filter((file) => file.endsWith("_tweets.json"));

  if (files.length === 0) {
    console.log("No tweet JSON files found with pattern *_tweets.json");
    return;
  }

  console.log(`Found ${files.length} tweet files:\n`);

  const allResults: FrequencyData[] = [];

  for (const file of files) {
    try {
      const username = file.replace("_tweets.json", "");
      const content = readFileSync(file, "utf-8");
      const tweets: Tweet[] = JSON.parse(content);

      // Filter tweets with valid dates and parse them
      const validTweets: TweetWithParsedDate[] = tweets
        .filter((t) => t.date !== null)
        .map((t) => ({
          ...t,
          parsedDate: new Date(t.date!),
        }));

      if (validTweets.length === 0) {
        console.log(`⚠️  ${username}: No tweets with valid dates`);
        continue;
      }

      // Calculate frequency by month (YYYY-MM)
      const byMonth: Record<string, number> = {};
      for (const tweet of validTweets) {
        const monthKey = `${tweet.parsedDate.getFullYear()}-${String(tweet.parsedDate.getMonth() + 1).padStart(2, "0")}`;
        byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
      }

      // Calculate frequency by day of week
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const byDayOfWeek: Record<string, number> = {};
      for (const tweet of validTweets) {
        const day = dayNames[tweet.parsedDate.getDay()];
        byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1;
      }

      // Calculate frequency by hour
      const byHour: Record<number, number> = {};
      for (const tweet of validTweets) {
        const hour = tweet.parsedDate.getHours();
        byHour[hour] = (byHour[hour] || 0) + 1;
      }

      // Calculate average and standard deviation for tweets per day
      const byDay: Record<string, number> = {};
      for (const tweet of validTweets) {
        const dayKey = tweet.parsedDate.toISOString().split("T")[0]; // YYYY-MM-DD
        byDay[dayKey] = (byDay[dayKey] || 0) + 1;
      }

      // Find full date range (earliest to latest tweet)
      const dates = validTweets.map(t => t.parsedDate.getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      minDate.setHours(0, 0, 0, 0);
      maxDate.setHours(23, 59, 59, 999);

      // Calculate total days in range
      const totalDaysInRange = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Create array with counts for ALL days (including zeros)
      const allDayCounts: number[] = [];
      const currentDate = new Date(minDate);
      for (let i = 0; i < totalDaysInRange; i++) {
        const dayKey = currentDate.toISOString().split("T")[0];
        allDayCounts.push(byDay[dayKey] || 0);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const avgTweetsPerDay = totalDaysInRange > 0 
        ? validTweets.length / totalDaysInRange 
        : 0;
      
      const variance = totalDaysInRange > 0
        ? allDayCounts.reduce((sum, count) => sum + Math.pow(count - avgTweetsPerDay, 2), 0) / totalDaysInRange
        : 0;
      const stdDevTweetsPerDay = Math.sqrt(variance);

      // Calculate gaps between tweets (in hours)
      const sortedTweets = [...validTweets].sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
      const gaps: number[] = [];
      for (let i = 1; i < sortedTweets.length; i++) {
        const gapInHours = (sortedTweets[i].parsedDate.getTime() - sortedTweets[i - 1].parsedDate.getTime()) / (1000 * 60 * 60);
        gaps.push(gapInHours);
      }

      const avgGapBetweenTweets = gaps.length > 0
        ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
        : 0;

      const gapVariance = gaps.length > 0
        ? gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGapBetweenTweets, 2), 0) / gaps.length
        : 0;
      const stdDevGap = Math.sqrt(gapVariance);

      // Calculate burst index (max tweets/day ÷ avg tweets/day)
      const maxTweetsPerDay = allDayCounts.length > 0 ? Math.max(...allDayCounts) : 0;
      const burstIndex = avgTweetsPerDay > 0 ? maxTweetsPerDay / avgTweetsPerDay : 0;

      const result: FrequencyData = {
        username,
        totalTweets: validTweets.length,
        byMonth,
        byDayOfWeek,
        byHour,
        avgTweetsPerDay,
        stdDevTweetsPerDay,
        avgGapBetweenTweets,
        stdDevGap,
        burstIndex,
      };

      allResults.push(result);

      // Display results for this user
      const consistency = categorizeConsistency(stdDevTweetsPerDay);
      
      console.log(`${colors.cyan}${colors.bright}📊 ${username}${colors.reset}`);
      console.log(`   Total tweets: ${colors.bright}${validTweets.length}${colors.reset}`);
      console.log(`   Average tweets per day: ${colors.bright}${avgTweetsPerDay.toFixed(2)}${colors.reset}`);
      console.log(`   Standard deviation: ${consistency.color}${stdDevTweetsPerDay.toFixed(2)} (${consistency.category})${colors.reset}`);
      console.log();
      
      // Gap and burst metrics
      console.log(`   ${colors.magenta}Gap & Burst Metrics:${colors.reset}`);
      console.log(`   Average gap between tweets: ${colors.bright}${avgGapBetweenTweets.toFixed(2)}${colors.reset} hours`);
      console.log(`   Std deviation of gaps: ${colors.bright}${stdDevGap.toFixed(2)}${colors.reset} hours`);
      console.log(`   Burst index: ${colors.bright}${burstIndex.toFixed(2)}${colors.reset}`);
      console.log();

      // Top 5 most active months
      const topMonths = Object.entries(byMonth)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      console.log(`   ${colors.magenta}Top 5 months:${colors.reset}`);
      for (const [month, count] of topMonths) {
        console.log(`   ${month}: ${colors.bright}${count}${colors.reset} tweets`);
      }
      console.log();

      // Most active day of week
      const topDay = Object.entries(byDayOfWeek)
        .sort(([, a], [, b]) => b - a)[0];
      console.log(`   ${colors.blue}Most active day:${colors.reset} ${topDay[0]} (${colors.bright}${topDay[1]}${colors.reset} tweets)`);
      console.log();

      // Most active hours
      const topHours = Object.entries(byHour)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);
      console.log(`   ${colors.blue}Top 3 hours:${colors.reset}`);
      for (const [hour, count] of topHours) {
        console.log(`   ${hour}:00 - ${colors.bright}${count}${colors.reset} tweets`);
      }
      console.log();

      // Render GitHub-style heatmap
      renderGitHubStyleHeatmap(validTweets);
      
      console.log("\n" + "─".repeat(50) + "\n");

    } catch (error) {
      console.error(`Error processing ${file}: ${(error as Error).message}`);
    }
  }

  // Summary statistics
  if (allResults.length > 0) {
    const totalTweets = allResults.reduce((sum, r) => sum + r.totalTweets, 0);
    const avgTweetsPerUser = Math.round(totalTweets / allResults.length);
    
    console.log(`${colors.cyan}${colors.bright}📈 SUMMARY${colors.reset}`);
    console.log(`Total users analyzed: ${colors.bright}${allResults.length}${colors.reset}`);
    console.log(`Total tweets: ${colors.bright}${totalTweets}${colors.reset}`);
    console.log(`Average tweets per user: ${colors.bright}${avgTweetsPerUser}${colors.reset}`);
    console.log();
    
    // Consistency breakdown
    const consistencyBreakdown = {
      veryConsistent: 0,
      somewhatIrregular: 0,
      highlyBursty: 0,
    };
    
    for (const result of allResults) {
      if (result.stdDevTweetsPerDay >= 0.7) {
        consistencyBreakdown.highlyBursty++;
      } else if (result.stdDevTweetsPerDay >= 0.5) {
        consistencyBreakdown.somewhatIrregular++;
      } else {
        consistencyBreakdown.veryConsistent++;
      }
    }
    
    console.log(`${colors.bright}Consistency breakdown:${colors.reset}`);
    console.log(`  ${colors.green}Very consistent:${colors.reset} ${consistencyBreakdown.veryConsistent} users`);
    console.log(`  ${colors.yellow}Somewhat irregular:${colors.reset} ${consistencyBreakdown.somewhatIrregular} users`);
    console.log(`  ${colors.red}Highly bursty:${colors.reset} ${consistencyBreakdown.highlyBursty} users`);
  }
}

analyzeTweetFrequency();
