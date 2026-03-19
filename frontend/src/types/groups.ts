export type GroupRole = "admin" | "moderator" | "member";

export type Group = {
  id: string;
  name: string;
  description?: string;
  user_role?: GroupRole;
};

export type GroupWithRole = {
  id: string;
  name: string;
  user_role: GroupRole;
};

export type GroupMember = {
  id: string;
  user_id: string;
  email: string;
  role: GroupRole;
  joined_at: string;
};

export type CreateGroupRequest = {
  name: string;
  description?: string;
};

export type AddMemberRequest = {
  email: string;
};

export type ChangeRoleRequest = {
  user_id: string;
  role: GroupRole;
};

export type TransferAdminshipRequest = {
  new_admin_id: string;
};

export type UpdateGroupRequest = {
  name: string;
  description?: string;
};
