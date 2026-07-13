import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { AppRole } from "./useUserRole";

export function useUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createUser = useMutation({
    mutationFn: async ({
      email,
      password,
      fullName,
      role,
      levelId,
      organizationId,
      moduleAccess,
    }: {
      email: string;
      password: string;
      fullName: string;
      role: AppRole;
      levelId?: string;
      organizationId?: string;
      moduleAccess?: {
        canAccessPublic: boolean;
        canAccessPrivate: boolean;
      };
    }) => {
      // Call the edge function to create user with proper privileges
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email,
          password,
          fullName,
          role,
          levelId,
          organizationId,
          moduleAccess,
          assignedBy: user?.id,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to create user");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data.user;
    },
    onSuccess: (_, variables) => {
      // Invalidate all relevant queries based on the role
      queryClient.invalidateQueries({ queryKey: ["users-by-role", variables.role] });
      queryClient.invalidateQueries({ queryKey: ["learners"] });
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      queryClient.invalidateQueries({ queryKey: ["manager-access"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      toast.success("User created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create user: " + error.message);
    },
  });

  const deleteUser = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { targetUserId: userId },
      });

      if (error) {
        throw new Error(error.message || "Failed to delete user");
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-by-role"] });
      queryClient.invalidateQueries({ queryKey: ["learners"] });
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      toast.success("User deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete user: " + error.message);
    },
  });

  const bulkCreateUsers = useMutation({
    mutationFn: async ({
      users,
      organizationId,
    }: {
      users: { email: string; fullName: string; password: string }[];
      organizationId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("bulk-create-users", {
        body: { users, organizationId },
      });

      if (error) {
        throw new Error(error.message || "Failed to bulk create users");
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      return data as { successCount: number; failureCount: number; results: { email: string; success: boolean; error?: string }[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["learners"] });
      if (data.failureCount === 0) {
        toast.success(`Created ${data.successCount} learners successfully`);
      } else {
        toast.warning(`Created ${data.successCount} learners, ${data.failureCount} failed`);
      }
    },
    onError: (error) => {
      toast.error("Bulk creation failed: " + error.message);
    },
  });

  const updateUserProfile = useMutation({
    mutationFn: async ({
      userId,
      fullName,
      isActive,
    }: {
      userId: string;
      fullName?: string;
      isActive?: boolean;
    }) => {
      const updates: Record<string, unknown> = {};
      if (fullName !== undefined) updates.full_name = fullName;
      if (isActive !== undefined) updates.is_active = isActive;

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;
      return { userId, ...updates };
    },
    onSuccess: () => {
      // Invalidate all user-related queries
      queryClient.invalidateQueries({ queryKey: ["users-by-role"] });
      queryClient.invalidateQueries({ queryKey: ["learners"] });
      toast.success("User updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update user: " + error.message);
    },
  });

  const toggleUserActive = useMutation({
    mutationFn: async ({
      userId,
      isActive,
    }: {
      userId: string;
      isActive: boolean;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: isActive })
        .eq("id", userId);

      if (error) throw error;
      return { userId, isActive };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users-by-role"] });
      queryClient.invalidateQueries({ queryKey: ["learners"] });
      toast.success(variables.isActive ? "User activated" : "User deactivated");
    },
    onError: (error) => {
      toast.error("Failed to update user status: " + error.message);
    },
  });

  const updateUserOrganizations = useMutation({
    mutationFn: async ({
      userId,
      organizationIds,
    }: {
      userId: string;
      organizationIds: string[];
    }) => {
      // First, remove all existing organization assignments
      const { error: deleteError } = await supabase
        .from("user_organizations")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Then, add new organization assignments
      if (organizationIds.length > 0) {
        const { error: insertError } = await supabase
          .from("user_organizations")
          .insert(
            organizationIds.map((orgId) => ({
              user_id: userId,
              organization_id: orgId,
              assigned_by: user?.id,
            }))
          );

        if (insertError) throw insertError;
      }

      return { userId, organizationIds };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-by-role"] });
      toast.success("User organizations updated");
    },
    onError: (error) => {
      toast.error("Failed to update organizations: " + error.message);
    },
  });

  return {
    createUser,
    deleteUser,
    bulkCreateUsers,
    updateUserProfile,
    toggleUserActive,
    updateUserOrganizations,
  };
}
