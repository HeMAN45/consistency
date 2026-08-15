import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Global catalogue. Per-user default tasks are seeded at registration. */
const ACHIEVEMENTS = [
  { code: "FIRST_BLOOD", name: "First Blood", description: "Your first perfect day.", sortOrder: 1 },
  { code: "IRON_WEEK", name: "Iron Week", description: "Seven perfect days in a row.", sortOrder: 2 },
  { code: "NO_EXCUSES", name: "No Excuses", description: "Thirty perfect days in a row.", sortOrder: 3 },
  { code: "CODE_WARRIOR", name: "Code Warrior", description: "Thirty days of completed DSA work.", sortOrder: 4 },
  { code: "FORGED", name: "Forged", description: "Fifty gym sessions logged.", sortOrder: 5 },
  { code: "BEFORE_SUNRISE", name: "Before Sunrise", description: "Twenty wake-ups on target.", sortOrder: 6 },
  { code: "THE_GRIND", name: "The Grind", description: "One hundred perfect days.", sortOrder: 7 },
  { code: "RELENTLESS", name: "Relentless", description: "Rebuilt a seven-day streak after breaking one of fourteen or more.", sortOrder: 8 },
  { code: "DEEP_WORK", name: "Deep Work", description: "A single focus session of two hours.", sortOrder: 9 },
  { code: "TEN_K_CLUB", name: "10k Club", description: "Thirty days of hitting your step goal.", sortOrder: 10 },
];

// Original lines — no copyrighted lyrics or long passages (PRD §17).
const QUOTES = [
  { text: "The work you skip today is the work you distrust yourself with tomorrow.", category: "discipline" },
  { text: "Motivation picks the day. Consistency picks the year.", category: "discipline" },
  { text: "A streak is just a decision you stopped renegotiating.", category: "streak" },
  { text: "Small work, done daily, outruns big work done rarely.", category: "discipline" },
  { text: "You do not rise to your plan. You fall to your logging.", category: "tracking" },
  { text: "The hard part was never the problem set. It was opening it.", category: "focus" },
  { text: "Broken streaks are data, not verdicts.", category: "comeback" },
  { text: "Rank is a receipt. The work already happened.", category: "rank" },
  { text: "Discipline is choosing once, then not renegotiating.", category: "discipline" },
  { text: "The plan was never the hard part.", category: "focus" },
  { text: "Two hours you actually spent beat eight you meant to.", category: "focus" },
  { text: "Show up on the day you least want to. That one counts double.", category: "discipline" },
  { text: "Nobody is coming to check. That is the whole problem.", category: "accountability" },
  { text: "Progress is boring up close and obvious from a distance.", category: "progress" },
  { text: "A bad day logged honestly is worth more than a good day forgotten.", category: "tracking" },
  { text: "You are not behind. You are just unlogged.", category: "tracking" },
  { text: "Skill compounds. So does avoidance.", category: "discipline" },
  { text: "The gap between knowing and doing is measured in days, not ideas.", category: "discipline" },
  { text: "Start before you feel ready, or you will start never.", category: "focus" },
  { text: "Your average day is your real ability.", category: "progress" },
  { text: "Rest is part of the plan. Drifting is not.", category: "recovery" },
  { text: "One day is noise. Thirty is a person.", category: "streak" },
  { text: "Momentum is expensive to build and cheap to lose.", category: "streak" },
  { text: "Every streak you have ever had started at one.", category: "comeback" },
  { text: "Falling off is normal. Staying off is a decision.", category: "comeback" },
  { text: "Do the work while it is still unimpressive.", category: "progress" },
  { text: "Consistency is what talent looks like from the outside.", category: "discipline" },
  { text: "The scoreboard only counts what you finished.", category: "rank" },
];

async function main() {
  for (const achievement of ACHIEVEMENTS) {
    await db.achievement.upsert({
      where: { code: achievement.code },
      update: achievement,
      create: achievement,
    });
  }

  // Additive: re-running tops up new quotes without duplicating old ones.
  let addedQuotes = 0;
  for (const quote of QUOTES) {
    const exists = await db.quote.findFirst({ where: { text: quote.text }, select: { id: true } });
    if (!exists) {
      await db.quote.create({ data: quote });
      addedQuotes += 1;
    }
  }

  console.log(`Seeded ${ACHIEVEMENTS.length} achievements and added ${addedQuotes} quotes.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
