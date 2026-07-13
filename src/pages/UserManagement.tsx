import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { useLearners } from "@/hooks/useLearners";
import { useLevels } from "@/hooks/useLevels";
import { useUsers } from "@/hooks/useUsers";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { useUsersByRole, UserWithRole } from "@/hooks/useUsersByRole";
import { useOrganizations } from "@/hooks/useOrganizations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, Loader2, Search, Globe, Lock, Building2, MoreHorizontal, Pencil, UserX, UserCheck, Trash2, Upload } from "lucide-react";
import { getRoleDisplayName } from "@/lib/roleDisplayNames";
import { BulkAddLearnersDialog } from "@/components/BulkAddLearnersDialog";

export default function UserManagement() {
  const { isAdmin } = useUserRole();
  const { learners, isLoading, toggleActive } = useLearners();
  const { levels } = useLevels();
  const { createUser, deleteUser, bulkCreateUsers, updateUserProfile, toggleUserActive, updateUserOrganizations } = useUsers();
  const [learnerToDelete, setLearnerToDelete] = useState<{ id: string; name: string } | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const { users: managers, isLoading: managersLoading } = useUsersByRole("manager");
  const { users: smes, isLoading: smesLoading } = useUsersByRole("sme");
  const { users: smeExperts, isLoading: smeExpertsLoading } = useUsersByRole("sme_expert");
  const { users: admins, isLoading: adminsLoading } = useUsersByRole("admin");
  const { organizations, isLoading: orgsLoading } = useOrganizations();

  // Find the Internal organization as default
  const internalOrg = organizations.find(org => org.name === "Internal");

  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    selectedOrganizations: [] as string[],
  });
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "manager" as AppRole,
    organizationId: "",
  });

  const filteredLearners = learners.filter(
    (learner) =>
      learner.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      learner.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.fullName) return;
    
    // For managers (non-admin), role is always 'learner' and org is auto-assigned
    const effectiveRole = isAdmin ? newUser.role : "learner";
    
    // Organization is required only for admin-created users (managers auto-assign)
    const organizationId = isAdmin ? (newUser.organizationId || internalOrg?.id) : undefined;
    
    if (isAdmin && !organizationId) {
      return; // Admin must select an organization
    }

    await createUser.mutateAsync({
      email: newUser.email,
      password: newUser.password,
      fullName: newUser.fullName,
      role: effectiveRole,
      organizationId: organizationId,
    });

    setIsDialogOpen(false);
    setNewUser({
      email: "",
      password: "",
      fullName: "",
      role: "manager",
      organizationId: "",
    });
  };

  const handleToggleActive = (userId: string, currentStatus: boolean) => {
    toggleActive.mutate({ userId, isActive: !currentStatus });
  };

  const handleToggleUserActive = (userId: string, currentStatus: boolean) => {
    toggleUserActive.mutate({ userId, isActive: !currentStatus });
  };

  const handleEditUser = (user: UserWithRole) => {
    setEditingUser(user);
    setEditFormData({
      fullName: user.full_name || "",
      selectedOrganizations: user.organizations?.map(o => o.id) || [],
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    // Update profile
    if (editFormData.fullName !== editingUser.full_name) {
      await updateUserProfile.mutateAsync({
        userId: editingUser.id,
        fullName: editFormData.fullName,
      });
    }

    // Update organizations
    const currentOrgIds = editingUser.organizations?.map(o => o.id) || [];
    const newOrgIds = editFormData.selectedOrganizations;
    const orgsChanged = JSON.stringify(currentOrgIds.sort()) !== JSON.stringify(newOrgIds.sort());
    
    if (orgsChanged) {
      await updateUserOrganizations.mutateAsync({
        userId: editingUser.id,
        organizationIds: newOrgIds,
      });
    }

    setEditDialogOpen(false);
    setEditingUser(null);
  };

  const handleOrgToggle = (orgId: string) => {
    setEditFormData(prev => ({
      ...prev,
      selectedOrganizations: prev.selectedOrganizations.includes(orgId)
        ? prev.selectedOrganizations.filter(id => id !== orgId)
        : [...prev.selectedOrganizations, orgId],
    }));
  };

  if (isLoading) {
    return (
      <AppSidebar>
        <div className="min-h-screen bg-gradient-subtle">
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </AppSidebar>
    );
  }

  return (
    <AppSidebar>
      <div className="min-h-screen bg-gradient-subtle">
        <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {isAdmin ? "User Management" : "Learner Management"}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin ? "Create and manage all users" : "Manage learners and assign levels"}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                {isAdmin ? "Create User" : "Add Learner"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isAdmin ? "Create New User" : "Add New Learner"}</DialogTitle>
                <DialogDescription>
                  {isAdmin 
                    ? "Fill in the details to create a new user account."
                    : "Add a new learner to your organization. They will be automatically assigned to your organization."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value) => setNewUser({ ...newUser, role: value as AppRole })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">{getRoleDisplayName("manager")}</SelectItem>
                        <SelectItem value="sme">{getRoleDisplayName("sme")}</SelectItem>
                        <SelectItem value="sme_expert">{getRoleDisplayName("sme_expert")}</SelectItem>
                        <SelectItem value="admin">{getRoleDisplayName("admin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="organization" className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      Organization
                    </Label>
                    <Select
                      value={newUser.organizationId || internalOrg?.id || ""}
                      onValueChange={(value) => setNewUser({ ...newUser, organizationId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            <div className="flex items-center gap-2">
                              {org.name}
                              <Badge variant="outline" className="text-xs ml-1">
                                {org.access_type === "public" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      User's access to courses and modules is determined by organization
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={createUser.isPending}>
                  {createUser.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>
                  Update user details and organization assignments.
                </DialogDescription>
              </DialogHeader>
              {editingUser && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="editFullName">Full Name</Label>
                    <Input
                      id="editFullName"
                      value={editFormData.fullName}
                      onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={editingUser.email} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      Organizations
                    </Label>
                    <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                      {organizations.map((org) => (
                        <div key={org.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`org-${org.id}`}
                            checked={editFormData.selectedOrganizations.includes(org.id)}
                            onCheckedChange={() => handleOrgToggle(org.id)}
                          />
                          <label htmlFor={`org-${org.id}`} className="flex items-center gap-2 text-sm cursor-pointer">
                            {org.name}
                            <Badge variant="outline" className="text-xs">
                              {org.access_type === "public" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            </Badge>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveEdit} 
                  disabled={updateUserProfile.isPending || updateUserOrganizations.isPending}
                >
                  {(updateUserProfile.isPending || updateUserOrganizations.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isAdmin ? (
          <Tabs defaultValue="managers" className="space-y-6">
            <TabsList>
              <TabsTrigger value="managers">{getRoleDisplayName("manager")}s ({managers.length})</TabsTrigger>
              <TabsTrigger value="smes">{getRoleDisplayName("sme")}s ({smes.length})</TabsTrigger>
              <TabsTrigger value="sme_experts">{getRoleDisplayName("sme_expert")}s ({smeExperts.length})</TabsTrigger>
              <TabsTrigger value="admins">{getRoleDisplayName("admin")}s ({admins.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="managers">
              <Card>
                <CardHeader>
                  <CardTitle>Managers</CardTitle>
                  <CardDescription>
                    Manager access to courses is determined by their organization's access type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {managersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : managers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No managers found. Create a manager using the "Create User" button above.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Organization</TableHead>
                          <TableHead>Access</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {managers.map((manager) => (
                          <TableRow key={manager.id}>
                            <TableCell className="font-medium">
                              {manager.full_name || "—"}
                            </TableCell>
                            <TableCell>{manager.email}</TableCell>
                            <TableCell>
                              {manager.organizations?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {manager.organizations.map((org) => (
                                    <Badge key={org.id} variant="outline" className="text-xs">
                                      <Building2 className="h-3 w-3 mr-1" />
                                      {org.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {manager.organizations?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {manager.organizations.map((org) => (
                                    <Badge 
                                      key={org.id} 
                                      variant={org.access_type === "public" ? "secondary" : "outline"}
                                      className="text-xs"
                                    >
                                      {org.access_type === "public" ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                                      {org.access_type}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={manager.is_active !== false ? "default" : "secondary"}>
                                {manager.is_active !== false ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(manager.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditUser(manager)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleToggleUserActive(manager.id, !(manager.is_active !== false))}
                                    className={manager.is_active !== false ? "text-destructive" : "text-green-600"}
                                  >
                                    {manager.is_active !== false ? (
                                      <>
                                        <UserX className="h-4 w-4 mr-2" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Activate
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="smes">
              <Card>
                <CardHeader>
                  <CardTitle>Module Designers</CardTitle>
                  <CardDescription>
                    Module Designers can create and manage learning modules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {smesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : smes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No Module Designers found. Create a Module Designer using the "Create User" button above.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Organization</TableHead>
                          <TableHead>Access</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {smes.map((sme) => (
                          <TableRow key={sme.id}>
                            <TableCell className="font-medium">
                              {sme.full_name || "—"}
                            </TableCell>
                            <TableCell>{sme.email}</TableCell>
                            <TableCell>
                              {sme.organizations?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {sme.organizations.map((org) => (
                                    <Badge key={org.id} variant="outline" className="text-xs">
                                      <Building2 className="h-3 w-3 mr-1" />
                                      {org.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {sme.organizations?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {sme.organizations.map((org) => (
                                    <Badge 
                                      key={org.id} 
                                      variant={org.access_type === "public" ? "secondary" : "outline"}
                                      className="text-xs"
                                    >
                                      {org.access_type === "public" ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                                      {org.access_type}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={sme.is_active !== false ? "default" : "secondary"}>
                                {sme.is_active !== false ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(sme.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditUser(sme)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleToggleUserActive(sme.id, !(sme.is_active !== false))}
                                    className={sme.is_active !== false ? "text-destructive" : "text-green-600"}
                                  >
                                    {sme.is_active !== false ? (
                                      <>
                                        <UserX className="h-4 w-4 mr-2" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Activate
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sme_experts">
              <Card>
                <CardHeader>
                  <CardTitle>SMEs</CardTitle>
                  <CardDescription>
                    SMEs review and approve modules submitted by Module Designers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {smeExpertsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : smeExperts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No SMEs found. Create an SME using the "Create User" button above.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Organization</TableHead>
                          <TableHead>Access</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {smeExperts.map((expert) => (
                          <TableRow key={expert.id}>
                            <TableCell className="font-medium">
                              {expert.full_name || "—"}
                            </TableCell>
                            <TableCell>{expert.email}</TableCell>
                            <TableCell>
                              {expert.organizations?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {expert.organizations.map((org) => (
                                    <Badge key={org.id} variant="outline" className="text-xs">
                                      <Building2 className="h-3 w-3 mr-1" />
                                      {org.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {expert.organizations?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {expert.organizations.map((org) => (
                                    <Badge 
                                      key={org.id} 
                                      variant={org.access_type === "public" ? "secondary" : "outline"}
                                      className="text-xs"
                                    >
                                      {org.access_type === "public" ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                                      {org.access_type}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={expert.is_active !== false ? "default" : "secondary"}>
                                {expert.is_active !== false ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(expert.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditUser(expert)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleToggleUserActive(expert.id, !(expert.is_active !== false))}
                                    className={expert.is_active !== false ? "text-destructive" : "text-green-600"}
                                  >
                                    {expert.is_active !== false ? (
                                      <>
                                        <UserX className="h-4 w-4 mr-2" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Activate
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="admins">
              <Card>
                <CardHeader>
                  <CardTitle>Administrators</CardTitle>
                  <CardDescription>
                    Admins have full access to all system features
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {adminsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : admins.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No admins found.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Organization</TableHead>
                          <TableHead>Access</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {admins.map((admin) => (
                          <TableRow key={admin.id}>
                            <TableCell className="font-medium">
                              {admin.full_name || "—"}
                            </TableCell>
                            <TableCell>{admin.email}</TableCell>
                            <TableCell>
                              {admin.organizations?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {admin.organizations.map((org) => (
                                    <Badge key={org.id} variant="outline" className="text-xs">
                                      <Building2 className="h-3 w-3 mr-1" />
                                      {org.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {admin.organizations?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {admin.organizations.map((org) => (
                                    <Badge 
                                      key={org.id} 
                                      variant={org.access_type === "public" ? "secondary" : "outline"}
                                      className="text-xs"
                                    >
                                      {org.access_type === "public" ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                                      {org.access_type}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={admin.is_active !== false ? "default" : "secondary"}>
                                {admin.is_active !== false ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(admin.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditUser(admin)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleToggleUserActive(admin.id, !(admin.is_active !== false))}
                                    className={admin.is_active !== false ? "text-destructive" : "text-green-600"}
                                  >
                                    {admin.is_active !== false ? (
                                      <>
                                        <UserX className="h-4 w-4 mr-2" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Activate
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Learners</CardTitle>
                  <CardDescription>{filteredLearners.length} learners found</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search learners..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" onClick={() => setBulkAddOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLearners.map((learner) => (
                    <TableRow key={learner.id}>
                      <TableCell className="font-medium">
                        {learner.full_name || "—"}
                      </TableCell>
                      <TableCell>{learner.email}</TableCell>
                      <TableCell>
                        <Badge variant={learner.is_active ? "default" : "secondary"}>
                          {learner.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={learner.is_active}
                            onCheckedChange={() => handleToggleActive(learner.id, learner.is_active)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {learner.is_active ? "Deactivate" : "Activate"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setLearnerToDelete({ id: learner.id, name: learner.full_name || learner.email })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLearners.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No learners found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={!!learnerToDelete} onOpenChange={() => setLearnerToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete learner?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {learnerToDelete?.name}'s account, including their progress, submissions, and certificates. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (learnerToDelete) {
                    deleteUser.mutate({ userId: learnerToDelete.id });
                    setLearnerToDelete(null);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BulkAddLearnersDialog
          open={bulkAddOpen}
          onOpenChange={setBulkAddOpen}
          onSubmit={(users) => bulkCreateUsers.mutate({ users })}
          isSubmitting={bulkCreateUsers.isPending}
        />
        </div>
      </div>
    </AppSidebar>
  );
}
