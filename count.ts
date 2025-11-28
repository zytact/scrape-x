import fs from "fs";

interface Tweet {
  id: string | null;
  url: string | null;
  date: string | null;
  text: string;
}

try {
  const data = fs.readFileSync("tweets.json", "utf8");
  const tweets: Tweet[] = JSON.parse(data);
  const count = tweets.length;
  console.log(`Number of items in the array: ${count}`);
  if (count === 100) {
    console.log("There are exactly 100 items in the array.");
  } else {
    console.log(`There are ${count} items, not 100.`);
  }
} catch (error) {
  console.error("Error reading or parsing the file:", (error as Error).message);
}
