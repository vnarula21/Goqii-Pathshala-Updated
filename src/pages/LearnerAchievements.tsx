import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Flame, Trophy, Sparkles, Snowflake, ArrowLeft, Lock, CheckCircle2 } from "lucide-react";
import { XPMeter } from "@/components/gamification";
import { AchievementCard } from "@/components/gamification/AchievementCard";
import {
  useGamification,
  LEVEL_XP_REQUIREMENTS,
  getLevelTitle,
} from "@/hooks/useGamification";

const XP_ACTIONS = [
  { xp: 10, title: "Complete a module", detail: "Finish a module, including any quiz or assignment it requires." },
  { xp: 50, title: "Pass a quiz on your first attempt", detail: "Read the module carefully - first-try passes earn the biggest reward." },
  { xp: 10, title: "Pass a quiz on a retry", detail: "Didn't get it first time? Passing later still earns XP." },
  { xp: 25, title: "Complete a course", detail: "Complete every module (and required assignments) and meet the pass mark." },
  { xp: 15, title: "Submit an assignment on time", detail: "Submit before the due date." },
];

const CATEGORY_LABELS: Record<string, string> = {
  progress: "Course progress",
  streak: "Learning streaks",
  quiz: "Quizzes",
  assignment: "Assignments",
  time: "Deadlines",
};

// Badge rules that are awarded automatically today.
const AUTO_TRACKED = new Set([
  "streak_days",
  "courses_completed",
  "early_completion",
  "high_score_assignment",
  "perfect_quiz",
]);

export default function LearnerAchievements() {
  const {
    userXP,
    userStreak,
    userBadges,
    allBadges,
    isLoading,
    currentLevel,
    levelTitle,
    xpProgress,
    xpToNextLevel,
    syncBadges,
  } = useGamification();

  // Award any badge the learner has already qualified for.
  useEffect(() => {
    if (!isLoading && allBadges.length > 0) syncBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, allBadges.length, userBadges.length, userStreak?.longest_streak]);

  const totalXP = userXP?.total_xp || 0;
  const earnedIds = new Set(userBadges.map((ub) => ub.badge_id));
  const earnedAt = new Map(userBadges.map((ub) => [ub.badge_id, ub.earned_at]));

  const categories = Array.from(new Set(allBadges.map((b) => b.category)));
  const nextLevelXP = LEVEL_XP_REQUIREMENTS[currentLevel] ?? null;

  if (isLoading) {
    return (
      <AppSidebar>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppSidebar>
    );
  }

  return (
    <AppSidebar>
      <div className="min-h-screen bg-gradient-subtle">
        <div className="container mx-auto px-3 py-4 max-w-5xl space-y-4">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/learner"><ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard</Link>
          </Button>

          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-amber-500" /> Achievements &amp; Rewards
            </h1>
            <p className="text-sm text-muted-foreground">
              Learn, earn XP, level up and collect badges. Here is exactly how it works.
            </p>
          </div>

          {/* Current status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-6">
                <XPMeter
                  currentXP={totalXP}
                  xpProgress={xpProgress}
                  currentLevel={currentLevel}
                  levelTitle={levelTitle}
                  xpToNextLevel={xpToNextLevel}
                  size="lg"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full">
                  <Stat icon={<Sparkles className="h-4 w-4 text-purple-500" />} label="Total XP" value={totalXP.toLocaleString()} />
                  <Stat icon={<Sparkles className="h-4 w-4 text-purple-500" />} label="XP this week" value={String(userXP?.xp_this_week || 0)} />
                  <Stat icon={<Flame className="h-4 w-4 text-orange-500" />} label="Current streak" value={`${userStreak?.current_streak || 0} day${(userStreak?.current_streak || 0) === 1 ? "" : "s"}`} />
                  <Stat icon={<Trophy className="h-4 w-4 text-amber-500" />} label="Badges earned" value={`${userBadges.length}/${allBadges.length}`} />
                </div>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                {nextLevelXP !== null ? (
                  <>
                    You are <b className="text-foreground">Level {currentLevel} - {levelTitle}</b>.{" "}
                    {xpToNextLevel} more XP to reach <b className="text-foreground">Level {currentLevel + 1} - {getLevelTitle(currentLevel + 1)}</b>.
                  </>
                ) : (
                  <>You have reached the top level - <b className="text-foreground">Champion</b>. Keep going to collect every badge!</>
                )}
                <Progress value={xpProgress} className="h-2 mt-2" />
                <p className="mt-2">
                  Longest streak: <b className="text-foreground">{userStreak?.longest_streak || 0} days</b>
                  {userStreak?.freeze_available && (
                    <span className="inline-flex items-center gap-1 ml-3 text-cyan-600">
                      <Snowflake className="h-3.5 w-3.5" /> Streak freeze available
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* How to earn XP */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How to earn XP</CardTitle>
              <CardDescription>XP is added automatically as you learn.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {XP_ACTIONS.map((a) => (
                <div key={a.title} className="flex items-center gap-3 py-2.5">
                  <UiBadge className="w-16 justify-center bg-purple-600 hover:bg-purple-600">+{a.xp} XP</UiBadge>
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 py-2.5">
                <UiBadge variant="outline" className="w-16 justify-center">Bonus</UiBadge>
                <div>
                  <p className="text-sm font-medium">Earn a badge</p>
                  <p className="text-xs text-muted-foreground">Every badge below also gives you bonus XP.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Levels */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Levels</CardTitle>
              <CardDescription>Your level goes up as your total XP grows.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {LEVEL_XP_REQUIREMENTS.map((xp, i) => {
                const lvl = i + 1;
                const reached = currentLevel >= lvl;
                return (
                  <div
                    key={lvl}
                    className={`rounded-lg border p-3 text-center ${reached ? "bg-purple-500/10 border-purple-500/40" : "opacity-70"}`}
                  >
                    <p className="text-xs text-muted-foreground">Level {lvl}</p>
                    <p className="font-semibold text-sm">{getLevelTitle(lvl)}</p>
                    <p className="text-xs mt-1">{xp} XP</p>
                    {reached && <CheckCircle2 className="h-4 w-4 text-purple-500 mx-auto mt-1" />}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Streaks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" /> Learning streaks</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>Do something on Pathshala every day - complete a module, pass a quiz or submit an assignment - to grow your streak.</p>
              <p>Missing a single day? A one-time <b className="text-foreground">streak freeze</b> can save your streak. Miss more than that and it restarts from 1.</p>
              <p>Reach 3, 7 and 30 days in a row to unlock streak badges.</p>
            </CardContent>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Badges</CardTitle>
              <CardDescription>
                {userBadges.length} of {allBadges.length} earned. Grey badges are still locked - here's how to unlock them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {categories.map((cat) => (
                <div key={cat}>
                  <h3 className="text-sm font-semibold mb-2">{CATEGORY_LABELS[cat] || cat}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allBadges
                      .filter((b) => b.category === cat)
                      .map((b) => {
                        const earned = earnedIds.has(b.id);
                        const tracked = AUTO_TRACKED.has(b.criteria?.type);
                        return (
                          <div key={b.id} className={`flex items-center gap-3 rounded-lg border p-3 ${earned ? "bg-muted/40" : ""}`}>
                            <AchievementCard
                              name={b.name}
                              description={b.description}
                              icon={b.icon}
                              color={b.color}
                              earned={earned}
                              earnedAt={earnedAt.get(b.id)}
                              xpReward={b.xp_reward}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{b.name}</p>
                              <p className="text-xs text-muted-foreground">{b.description}</p>
                              <p className="text-xs mt-1">
                                {earned ? (
                                  <span className="text-green-600 inline-flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Earned {new Date(earnedAt.get(b.id)!).toLocaleDateString()}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground inline-flex items-center gap-1">
                                    <Lock className="h-3 w-3" /> {tracked ? `Locked · +${b.xp_reward} XP` : "Coming soon"}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppSidebar>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}
