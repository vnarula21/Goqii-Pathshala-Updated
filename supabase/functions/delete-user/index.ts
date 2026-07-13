import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();

    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callingUserId = authData.user.id;
    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Missing targetUserId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetUserId === callingUserId) {
      return new Response(
        JSON.stringify({ error: 'You cannot delete your own account here' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: isAdmin } = await adminClient.rpc('has_role', {
      _user_id: callingUserId,
      _role: 'admin'
    });

    const { data: isManager } = await adminClient.rpc('has_role', {
      _user_id: callingUserId,
      _role: 'manager'
    });

    if (!isAdmin && !isManager) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only admins and managers can delete users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isManager && !isAdmin) {
      // Managers may only delete learners who belong to their own organization.
      const { data: targetRole } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .single();

      if (!targetRole || targetRole.role !== 'learner') {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Managers can only delete learners' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: managerOrg } = await adminClient
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', callingUserId)
        .single();

      const { data: targetOrg } = await adminClient
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', targetUserId)
        .single();

      if (!managerOrg || !targetOrg || managerOrg.organization_id !== targetOrg.organization_id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: You can only delete learners in your own organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Deleting the auth user cascades to profiles, user_roles,
    // user_organizations, etc. (all set up with ON DELETE CASCADE).
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
