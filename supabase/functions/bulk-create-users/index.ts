import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkLearnerInput {
  email: string;
  fullName: string;
  password: string;
}

interface BulkResult {
  email: string;
  success: boolean;
  error?: string;
}

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
        JSON.stringify({ error: 'Forbidden: Only admins and managers can bulk create learners' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { users, organizationId } = await req.json() as {
      users: BulkLearnerInput[];
      organizationId?: string;
    };

    if (!Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No users provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (users.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Maximum 500 users per bulk upload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Managers can only create learners within their own organization -
    // same restriction as the single-user create-user function.
    let effectiveOrgId = organizationId;
    if (isManager && !isAdmin) {
      const { data: managerOrg, error: managerOrgError } = await adminClient
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', callingUserId)
        .single();

      if (managerOrgError || !managerOrg) {
        return new Response(
          JSON.stringify({ error: 'Manager must belong to an organization to create learners' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      effectiveOrgId = managerOrg.organization_id;
    }

    const results: BulkResult[] = [];

    for (const entry of users) {
      const { email, fullName, password } = entry;

      if (!email || !fullName || !password) {
        results.push({ email: email || '(missing)', success: false, error: 'Missing email, fullName, or password' });
        continue;
      }

      try {
        const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          user_metadata: { full_name: fullName },
          email_confirm: true
        });

        if (createError || !userData?.user) {
          results.push({ email, success: false, error: createError?.message || 'Unknown error creating user' });
          continue;
        }

        const newUserId = userData.user.id;

        // Clear any auto-assigned role (signup trigger defaults to 'learner'
        // already, but this keeps behavior consistent/explicit) then assign learner.
        await adminClient.from('user_roles').delete().eq('user_id', newUserId);
        const { error: roleError } = await adminClient.from('user_roles').insert({ user_id: newUserId, role: 'learner' });

        if (roleError) {
          await adminClient.auth.admin.deleteUser(newUserId);
          results.push({ email, success: false, error: `Failed to assign role: ${roleError.message}` });
          continue;
        }

        if (effectiveOrgId) {
          await adminClient.from('user_organizations').insert({
            user_id: newUserId,
            organization_id: effectiveOrgId,
            assigned_by: callingUserId
          });
        }

        await adminClient.from('profiles').update({ must_change_password: true }).eq('id', newUserId);

        results.push({ email, success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({ email, success: false, error: message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return new Response(
      JSON.stringify({ success: true, successCount, failureCount, results }),
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
