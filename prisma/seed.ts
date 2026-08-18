import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Serverless Postgres may need a moment to wake before the first query. */
async function connectWithRetry(attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await db.$connect();
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`Database not ready, retrying (${attempt}/${attempts - 1})…`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 800));
    }
  }
}

/** Global catalogue. Per-user default tasks are seeded at registration. */
const ACHIEVEMENTS = [
  // Getting going
  { code: "FIRST_BLOOD", name: "Day One", description: "Your first perfect day.", sortOrder: 1 },
  { code: "FIRST_WEEK", name: "Settling In", description: "Seven days tracked.", sortOrder: 2 },
  { code: "IRON_WEEK", name: "Iron Week", description: "Seven perfect days in a row.", sortOrder: 3 },
  { code: "STEADY", name: "Steady", description: "A fortnight without breaking.", sortOrder: 4 },
  { code: "NO_EXCUSES", name: "No Excuses", description: "Thirty perfect days in a row.", sortOrder: 5 },
  { code: "THE_GRIND", name: "The Grind", description: "One hundred perfect days.", sortOrder: 6 },
  { code: "CENTURION", name: "Centurion", description: "One hundred days tracked.", sortOrder: 7 },

  // Category work
  { code: "CODE_WARRIOR", name: "Code Warrior", description: "Thirty days of completed DSA work.", sortOrder: 8 },
  { code: "QUERY_MASTER", name: "Query Master", description: "Thirty days of completed SQL work.", sortOrder: 9 },
  { code: "MODEL_CITIZEN", name: "Model Citizen", description: "Thirty days of completed ML work.", sortOrder: 10 },
  { code: "FORGED", name: "Forged", description: "Fifty gym sessions logged.", sortOrder: 11 },

  // Health and routine
  { code: "BEFORE_SUNRISE", name: "Before Sunrise", description: "Twenty wake-ups on target.", sortOrder: 12 },
  { code: "DAWN_PATROL", name: "Dawn Patrol", description: "One hundred wake-ups on target.", sortOrder: 13 },
  { code: "TEN_K_CLUB", name: "10k Club", description: "Thirty days of hitting your step goal.", sortOrder: 14 },
  { code: "ON_FOOT", name: "On Foot", description: "One hundred days of hitting your step goal.", sortOrder: 15 },

  // Focus
  { code: "DEEP_WORK", name: "Deep Work", description: "A single focus session of two hours.", sortOrder: 16 },
  { code: "IN_THE_ZONE", name: "In the Zone", description: "Twenty-five focus sessions completed.", sortOrder: 17 },
  { code: "TWENTY_HOURS", name: "Twenty Hours", description: "Twenty hours of focused work recorded.", sortOrder: 18 },

  // Watching
  { code: "STUDENT", name: "Student", description: "Twenty-five course videos watched.", sortOrder: 19 },
  { code: "COURSE_CLEARED", name: "Course Cleared", description: "Finished every video in a playlist.", sortOrder: 20 },
  { code: "BINGE_CONTROL", name: "Binge Control", description: "Five course videos in a single day.", sortOrder: 21 },

  // Problems
  { code: "FIRST_SOLVE", name: "First Solve", description: "Solved your first problem.", sortOrder: 22 },
  { code: "TEN_DOWN", name: "Ten Down", description: "Ten problems solved.", sortOrder: 23 },
  { code: "FIFTY_SOLVED", name: "Half a Century", description: "Fifty problems solved.", sortOrder: 24 },
  { code: "HUNDRED_SOLVED", name: "Century", description: "One hundred problems solved.", sortOrder: 25 },
  { code: "FIVE_HUNDRED_SOLVED", name: "Five Hundred", description: "Five hundred problems solved.", sortOrder: 26 },
  { code: "HARD_EARNED", name: "Hard Earned", description: "Twenty-five problems tagged hard, solved.", sortOrder: 27 },
  { code: "WELL_ROUNDED", name: "Well Rounded", description: "Solved problems on three different platforms.", sortOrder: 28 },
  { code: "DAILY_GRIND", name: "Daily Grind", description: "Solved at least one problem on thirty separate days.", sortOrder: 29 },

  // Together
  { code: "NOT_ALONE", name: "Not Alone", description: "Joined your first SYNC.", sortOrder: 30 },
  { code: "TEAM_PLAYER", name: "Team Player", description: "Fifty shared tasks completed.", sortOrder: 31 },

  // Recovery and honesty
  { code: "RELENTLESS", name: "Relentless", description: "Rebuilt a seven-day streak after breaking one of fourteen or more.", sortOrder: 32 },
  { code: "HONEST_RECKONING", name: "Honest Reckoning", description: "Named the reason for ten missed days.", sortOrder: 33 },
  { code: "PLANNED_REST", name: "Planned Rest", description: "Declared five rest days in advance.", sortOrder: 34 },
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
  await connectWithRetry();

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
