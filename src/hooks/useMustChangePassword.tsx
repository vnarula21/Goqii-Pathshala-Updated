import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useMustChangePassword() {
  const { user } = useAuth();
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMustChangePassword(false);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error("Failed to check must_change_password:", error);
          setMustChangePassword(false);
        } else {
          setMustChangePassword(!!data?.must_change_password);
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return { mustChangePassword, loading };
}
