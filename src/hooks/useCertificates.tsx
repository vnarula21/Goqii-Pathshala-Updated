import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CertificateConfig {
  id: string;
  course_id: string;
  is_enabled: boolean;
  min_passing_score: number;
  template_name: string;
  template_config: { primary_color?: string; secondary_color?: string } | null;
  validity_months: number | null;
}

export interface EarnedCertificate {
  id: string;
  user_id: string;
  course_id: string;
  certificate_id: string | null;
  score: number;
  issued_at: string;
  expires_at: string | null;
  verification_code: string;
  course: { title: string } | null;
  certificate: CertificateConfig | null;
}

function generateVerificationCode(): string {
  // Human-friendly, unique-enough code, e.g. CERT-9F3K2A7B
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CERT-${code}`;
}

export function useCertificates() {
  const queryClient = useQueryClient();

  const { data: myCertificates, isLoading } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];

      const { data, error } = await supabase
        .from("user_certificates")
        .select("*, course:courses(title), certificate:certificates(*)")
        .eq("user_id", userData.user.id)
        .order("issued_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as EarnedCertificate[];
    },
  });

  // Checks whether a course is configured to issue certificates, and if the
  // learner qualifies (score high enough), issues one - unless they already
  // have one for this course (UNIQUE(user_id, course_id) also guards this).
  const issueIfEligible = useMutation({
    mutationFn: async ({ courseId, score }: { courseId: string; score: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const { data: config } = await supabase
        .from("certificates")
        .select("*")
        .eq("course_id", courseId)
        .maybeSingle();

      // No certificate configured for this course, or explicitly disabled.
      if (!config || !config.is_enabled) return null;

      if (score < (config.min_passing_score ?? 70)) return null;

      // Already issued? Nothing to do.
      const { data: existing } = await supabase
        .from("user_certificates")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("course_id", courseId)
        .maybeSingle();

      if (existing) return null;

      const expiresAt = config.validity_months
        ? new Date(Date.now() + config.validity_months * 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data: inserted, error } = await supabase
        .from("user_certificates")
        .insert({
          user_id: userData.user.id,
          course_id: courseId,
          certificate_id: config.id,
          score,
          verification_code: generateVerificationCode(),
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) {
        // Unique constraint race (e.g. double-fire) - not a real failure.
        if (error.code === "23505") return null;
        throw error;
      }

      return inserted;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["my-certificates"] });
      }
    },
  });

  return {
    myCertificates: myCertificates || [],
    isLoading,
    issueIfEligible: issueIfEligible.mutateAsync,
  };
}
