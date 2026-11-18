import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UserXP {
  id: string;
  user_id: string;
  total_xp: number;
  current_level: number;
  xp_this_week: number;
  week_start_date: string | null;
}

interface UserStreak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  freeze_available: boolean;
}

interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  category: string;
  criteria: any;
  xp_reward: number;
}

interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

// XP required for each level
export const LEVEL_XP_REQUIREMENTS = [
  0,    // Level 1: 0 XP
  100,  // Level 2: 100 XP
  300,  // Level 3: 300 XP
  600,  // Level 4: 600 XP
  1000, // Level 5: 1000 XP
];

export function calculateLevel(totalXP: number): number {
  for (let i = LEVEL_XP_REQUIREMENTS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_XP_REQUIREMENTS[i]) {
      return i + 1;
    }
  }
  return 1;
}

export function getXPForNextLevel(currentLevel: number): number {
  if (currentLevel >= LEVEL_XP_REQUIREMENTS.length) {
    // Top level reached (calculateLevel never goes above it)
    return LEVEL_XP_REQUIREMENTS[LEVEL_XP_REQUIREMENTS.length - 1];
  }
  return LEVEL_XP_REQUIREMENTS[currentLevel] || LEVEL_XP_REQUIREMENTS[LEVEL_XP_REQUIREMENTS.length - 1];
}

export function getLevelTitle(level: number): string {
  const titles = ["Beginner", "Explorer", "Achiever", "Master", "Champion"];
  if (level <= titles.length) return titles[level - 1];
  return `Legend ${level - titles.length}`;
}

const syncingUsers = new Set<string>();

export function useGamification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user XP
  const { data: userXP, isLoading: xpLoading } = useQuery({
    queryKey: ["user-xp", user?.id],
    queryFn: async (): Promise<UserXP | null> => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("user_xp")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") {
        console.error("Error fetching XP:", error);
        return null;
      }
      
      return data;
    },
    enabled: !!user,
  });

  // Fetch user streak
  const { data: userStreak, isLoading: streakLoading } = useQuery({
    queryKey: ["user-streak", user?.id],
    queryFn: async (): Promise<UserStreak | null> => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("user_streaks")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") {
        console.error("Error fetching streak:", error);
        return null;
      }
      
      return data;
    },
    enabled: !!user,
  });

  // Fetch all badges
  const { data: allBadges = [] } = useQuery({
    queryKey: ["badges"],
    queryFn: async (): Promise<Badge[]> => {
      const { data, error } = await supabase
        .from("badges")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true });
      
      if (error) {
        console.error("Error fetching badges:", error);
        return [];
      }
      
      return data || [];
    },
  });

  // Fetch user's earned badges
  const { data: userBadges = [], isLoading: badgesLoading } = useQuery({
    queryKey: ["user-badges", user?.id],
    queryFn: async (): Promise<UserBadge[]> => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("user_badges")
        .select(`
          *,
          badge:badges(*)
        `)
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching user badges:", error);
        return [];
      }
      
      return data?.map(item => ({
        ...item,
        badge: item.badge as unknown as Badge
      })) || [];
    },
    enabled: !!user,
  });

  // Add XP mutation
  const addXP = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      if (!user) throw new Error("Not authenticated");

      // First, get or create user XP record
      const { data: existingXP } = await supabase
        .from("user_xp")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const weekStartDate = startOfWeek.toISOString().split('T')[0];

      if (existingXP) {
        // Update existing record
        const newTotalXP = existingXP.total_xp + amount;
        const newLevel = calculateLevel(newTotalXP);
        const weekXP = existingXP.week_start_date === weekStartDate 
          ? existingXP.xp_this_week + amount 
          : amount;

        const { error } = await supabase
          .from("user_xp")
          .update({
            total_xp: newTotalXP,
            current_level: newLevel,
            xp_this_week: weekXP,
            week_start_date: weekStartDate,
          })
          .eq("user_id", user.id);

        if (error) throw error;

        // Check for level up
        if (newLevel > existingXP.current_level) {
          toast.success(`🎉 Level Up! You're now Level ${newLevel}: ${getLevelTitle(newLevel)}!`);
        }

        return { newTotalXP, newLevel, amount, reason };
      } else {
        // Create new record
        const newLevel = calculateLevel(amount);
        const { error } = await supabase
          .from("user_xp")
          .insert({
            user_id: user.id,
            total_xp: amount,
            current_level: newLevel,
            xp_this_week: amount,
            week_start_date: weekStartDate,
          });

        if (error) throw error;

        return { newTotalXP: amount, newLevel, amount, reason };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-xp"] });
      toast.success(`+${data.amount} XP: ${data.reason}`);
    },
    onError: (error) => {
      console.error("Error adding XP:", error);
    },
  });

  // Update streak mutation
  const updateStreak = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const today = new Date().toISOString().split('T')[0];

      const { data: existingStreak } = await supabase
        .from("user_streaks")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (existingStreak) {
        const lastActivity = existingStreak.last_activity_date;
        
        // Already logged today
        if (lastActivity === today) {
          return existingStreak;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = existingStreak.current_streak;
        
        if (lastActivity === yesterdayStr) {
          // Continue streak
          newStreak = existingStreak.current_streak + 1;
        } else if (existingStreak.freeze_available && lastActivity) {
          // Use freeze if available
          const daysSinceActivity = Math.floor(
            (new Date(today).getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          if (daysSinceActivity === 2) {
            // Use freeze
            newStreak = existingStreak.current_streak + 1;
            await supabase
              .from("user_streaks")
              .update({
                freeze_available: false,
                freeze_used_this_week: today,
              })
              .eq("user_id", user.id);
            toast.info("🧊 Streak Freeze used! Your streak is saved!");
          } else {
            // Streak broken
            newStreak = 1;
          }
        } else {
          // Streak broken
          newStreak = 1;
        }

        const { data, error } = await supabase
          .from("user_streaks")
          .update({
            current_streak: newStreak,
            longest_streak: Math.max(newStreak, existingStreak.longest_streak),
            last_activity_date: today,
          })
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        // Check for streak badges
        if (newStreak === 3 || newStreak === 7 || newStreak === 30) {
          await checkAndAwardStreakBadge(newStreak);
        }

        return data;
      } else {
        // Create new streak record
        const { data, error } = await supabase
          .from("user_streaks")
          .insert({
            user_id: user.id,
            current_streak: 1,
            longest_streak: 1,
            last_activity_date: today,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-streak"] });
    },
  });

  // Award badge mutation
  const awardBadge = useMutation({
    mutationFn: async (badgeId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Check if already earned
      const { data: existing } = await supabase
        .from("user_badges")
        .select("id")
        .eq("user_id", user.id)
        .eq("badge_id", badgeId)
        .single();

      if (existing) return null;

      const { data, error } = await supabase
        .from("user_badges")
        .insert({
          user_id: user.id,
          badge_id: badgeId,
        })
        .select(`
          *,
          badge:badges(*)
        `)
        .single();

      if (error) throw error;

      // Award XP for the badge
      const badge = data.badge as unknown as Badge;
      if (badge?.xp_reward) {
        await addXP.mutateAsync({ 
          amount: badge.xp_reward, 
          reason: `Badge: ${badge.name}` 
        });
      }

      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["user-badges"] });
        const badge = data.badge as unknown as Badge;
        toast.success(`🏆 Badge Earned: ${badge?.name}!`, {
          description: badge?.description,
        });
      }
    },
  });

  const checkAndAwardStreakBadge = async (streakDays: number) => {
    const streakBadgeMap: Record<number, string> = {
      3: "On Fire",
      7: "Dedicated Learner",
      30: "Unstoppable",
    };

    const badgeName = streakBadgeMap[streakDays];
    if (!badgeName) return;

    const badge = allBadges.find(b => b.name === badgeName);
    if (badge) {
      await awardBadge.mutateAsync(badge.id);
    }
  };

  // Calculate progress to next level
  const currentXP = userXP?.total_xp || 0;
  const currentLevel = userXP?.current_level || 1;
  const xpForCurrentLevel = currentLevel <= LEVEL_XP_REQUIREMENTS.length 
    ? LEVEL_XP_REQUIREMENTS[currentLevel - 1] 
    : LEVEL_XP_REQUIREMENTS[LEVEL_XP_REQUIREMENTS.length - 1] + (currentLevel - LEVEL_XP_REQUIREMENTS.length) * 500;
  const xpForNextLevel = getXPForNextLevel(currentLevel);
  const isMaxLevel = currentLevel >= LEVEL_XP_REQUIREMENTS.length;
  const xpProgress = !isMaxLevel && xpForNextLevel > xpForCurrentLevel
    ? ((currentXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100
    : 100;

  const awardBadgeByName = async (name: string) => {
    const badge = allBadges.find((b) => b.name === name);
    if (!badge || userBadges.some((ub) => ub.badge_id === badge.id)) return;
    try {
      await awardBadge.mutateAsync(badge.id);
    } catch (e) {
      console.error("Failed to award badge:", e);
    }
  };

  // Awards every badge the learner already qualifies for, based on their saved
  // history (streaks, completed courses, early completions, graded assignments).
  // Safe to call repeatedly: badges already earned are skipped.
  const syncBadges = async () => {
    if (!user || allBadges.length === 0) return;
    const key = user.id;
    if (syncingUsers.has(key)) return;
    const earned = new Set(userBadges.map((ub) => ub.badge_id));
    const pending = allBadges.filter((b) => !earned.has(b.id));
    if (pending.length === 0) return;
    syncingUsers.add(key);
    try {
      const types = new Set(pending.map((b) => b.criteria?.type));
      let coursesCompleted = 0;
      let earlyCompletions = 0;
      let bestAssignmentPct = 0;

      if (types.has("courses_completed") || types.has("early_completion")) {
        const [{ data: done }, { data: assigned }] = await Promise.all([
          supabase.from("course_progress").select("course_id, completed_at").eq("user_id", user.id).eq("is_completed", true),
          supabase.from("course_assignments").select("course_id, due_date").eq("user_id", user.id),
        ]);
        coursesCompleted = done?.length || 0;
        const due = new Map((assigned || []).map((a) => [a.course_id, a.due_date]));
        earlyCompletions = (done || []).filter((d) => {
          const dd = due.get(d.course_id);
          return dd && d.completed_at && new Date(d.completed_at) <= new Date(dd);
        }).length;
      }
      if (types.has("high_score_assignment")) {
        const { data: subs } = await supabase
          .from("assessment_submissions")
          .select("score, max_score")
          .eq("user_id", user.id)
          .not("score", "is", null);
        for (const s of subs || []) {
          if (s.max_score > 0) bestAssignmentPct = Math.max(bestAssignmentPct, ((s.score as number) / s.max_score) * 100);
        }
      }

      const longestStreak = userStreak?.longest_streak || 0;
      for (const b of pending) {
        const c = b.criteria || {};
        let qualifies = false;
        switch (c.type) {
          case "streak_days": qualifies = longestStreak >= c.value; break;
          case "courses_completed": qualifies = coursesCompleted >= c.value; break;
          case "early_completion": qualifies = earlyCompletions >= c.value; break;
          case "high_score_assignment": qualifies = bestAssignmentPct >= c.value; break;
        }
        if (qualifies) await awardBadge.mutateAsync(b.id).catch((e) => console.error("Badge sync failed:", e));
      }
    } finally {
      syncingUsers.delete(key);
    }
  };

  return {
    userXP,
    userStreak,
    userBadges,
    allBadges,
    isLoading: xpLoading || streakLoading || badgesLoading,
    addXP: addXP.mutate,
    addXPAsync: addXP.mutateAsync,
    updateStreak: updateStreak.mutate,
    awardBadge: awardBadge.mutate,
    currentLevel,
    levelTitle: getLevelTitle(currentLevel),
    xpProgress,
    xpToNextLevel: isMaxLevel ? 0 : xpForNextLevel - currentXP,
    awardBadgeByName,
    syncBadges,
  };
}
