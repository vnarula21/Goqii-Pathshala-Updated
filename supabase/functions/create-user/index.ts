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

    // AUTHENTICATION: Verify the calling user is authenticated and has admin or manager role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's auth token to verify their identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    
    if (authError || !authData?.user) {
      console.error('Auth verification failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callingUserId = authData.user.id;

    // Create admin client to check role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if calling user has admin or manager role
    const { data: isAdmin, error: adminRoleError } = await adminClient.rpc('has_role', {
      _user_id: callingUserId,
      _role: 'admin'
    });

    const { data: isManager, error: managerRoleError } = await adminClient.rpc('has_role', {
      _user_id: callingUserId,
      _role: 'manager'
    });

    if ((adminRoleError && managerRoleError) || (!isAdmin && !isManager)) {
      console.error('Role check failed:', adminRoleError || managerRoleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only admins and managers can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, fullName, role, levelId, organizationId, assignedBy } = await req.json();

    // Managers can only create learners
    if (isManager && !isAdmin && role !== 'learner') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Managers can only create learners' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For managers creating learners, get the manager's organization
    let effectiveOrgId = organizationId;
    if (isManager && !isAdmin && role === 'learner') {
      const { data: managerOrg, error: managerOrgError } = await adminClient
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', callingUserId)
        .single();
      
      if (managerOrgError || !managerOrg) {
        console.error('Manager organization lookup failed:', managerOrgError);
        return new Response(
          JSON.stringify({ error: 'Manager must belong to an organization to create learners' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      effectiveOrgId = managerOrg.organization_id;
      console.log(`Manager ${callingUserId} creating learner in organization ${effectiveOrgId}`);
    }

    console.log(`User ${callingUserId} (admin: ${isAdmin}, manager: ${isManager}) is creating a new user`);
    console.log(`Creating user: ${email} with role: ${role}, organizationId: ${effectiveOrgId}`);

    // Validate required fields
    if (!email || !password || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, fullName, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user using admin API (doesn't affect caller's session)
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName },
      email_confirm: true
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = userData.user.id;
    console.log(`User created with ID: ${newUserId}`);

    // Remove any role the signup trigger may have auto-assigned (it defaults
    // new users to 'learner' before we get a chance to set their real role),
    // then assign the intended role. Without this delete, a different role
    // value never "conflicts" with the existing row, so upsert alone left
    // users with two roles (learner + their real role).
    const { error: deleteRoleError } = await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', newUserId);

    if (deleteRoleError) {
      console.error('Error clearing auto-assigned role:', deleteRoleError);
    }

    const { error: assignRoleError } = await adminClient.from('user_roles').insert(
      { user_id: newUserId, role: role }
    );

    if (assignRoleError) {
      console.error('Error assigning role:', assignRoleError);
      // Attempt to clean up the created user
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: `Failed to assign role: ${assignRoleError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Role ${role} assigned to user ${newUserId}`);

    // If learner and level provided, assign level
    if (role === 'learner' && levelId) {
      const { error: levelError } = await adminClient.from('learner_levels').insert({
        user_id: newUserId,
        level_id: levelId,
        assigned_by: assignedBy
      });

      if (levelError) {
        console.error('Error assigning level:', levelError);
        // Don't fail the whole operation, just log the error
      } else {
        console.log(`Level ${levelId} assigned to learner ${newUserId}`);
      }
    }

    // For learners, assign to organization (auto-assigned for managers, or specified by admin)
    if (role === 'learner' && effectiveOrgId) {
      const { error: orgError } = await adminClient.from('user_organizations').insert({
        user_id: newUserId,
        organization_id: effectiveOrgId,
        assigned_by: assignedBy
      });

      if (orgError) {
        console.error('Error assigning learner to organization:', orgError);
        // Don't fail the whole operation, just log the error
      } else {
        console.log(`Learner ${newUserId} assigned to organization ${effectiveOrgId}`);
      }
    }

    // For non-learner roles, assign to organization if provided
    if (role !== 'learner' && organizationId) {
      const { error: orgError } = await adminClient.from('user_organizations').insert({
        user_id: newUserId,
        organization_id: organizationId,
        assigned_by: assignedBy
      });

      if (orgError) {
        console.error('Error assigning organization:', orgError);
        // Don't fail the whole operation, just log the error
      } else {
        console.log(`Organization ${organizationId} assigned to user ${newUserId}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUserId,
          email: userData.user.email,
          role: role
        }
      }),
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
