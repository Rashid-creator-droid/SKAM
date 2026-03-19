import { getJson, postJson, putJson, deleteJson } from "../api";
import type {
  Group,
  GroupWithRole,
  GroupMember,
  CreateGroupRequest,
  AddMemberRequest,
  ChangeRoleRequest,
  TransferAdminshipRequest,
  UpdateGroupRequest,
} from "../types/groups";

export async function createGroup(data: CreateGroupRequest, token: string) {
  return postJson<Group>("/groups", data, token);
}

export async function getUserGroups(token: string) {
  return getJson<GroupWithRole[]>("/groups", token);
}

export async function getGroup(groupId: string, token: string) {
  return getJson<Group>(`/groups/${groupId}`, token);
}

export async function getGroupMembers(groupId: string, token: string) {
  return getJson<GroupMember[]>(`/groups/${groupId}/members`, token);
}

export async function addMember(groupId: string, data: AddMemberRequest, token: string) {
  return postJson<{ message: string }>(`/groups/${groupId}/members`, data, token);
}

export async function removeMember(groupId: string, userId: string, token: string) {
  return deleteJson<{ message: string }>(`/groups/${groupId}/members/${userId}`, token);
}

export async function changeRole(groupId: string, data: ChangeRoleRequest, token: string) {
  return putJson<{ message: string }>(`/groups/${groupId}/role`, data, token);
}

export async function transferAdminship(groupId: string, data: TransferAdminshipRequest, token: string) {
  return putJson<{ message: string }>(`/groups/${groupId}/transfer`, data, token);
}

export async function updateGroup(groupId: string, data: UpdateGroupRequest, token: string) {
  return putJson<{ message: string }>(`/groups/${groupId}`, data, token);
}

export async function deleteGroup(groupId: string, token: string) {
  return deleteJson<{ message: string }>(`/groups/${groupId}`, token);
}
