import client from "./client";

export interface UserProfilePayload {
  age?: number;
  gender?: string;
  heightCm?: number;
  weightLb?: number;
  preferredName?: string;
  pronouns?: string;
  bodyType?: string;
}

export interface UserSettingsPayload {
  temperatureUnit?: string;
  notificationsEnabled?: boolean;
}

export interface UserPrivacyPayload {
  profileVisible?: boolean;
  activityVisible?: boolean;
  dataSharingConsent?: boolean;
}

export const saveUserProfile = async (profile: UserProfilePayload) => {
  return client.post("/api/users/profile", profile);
};

export const updateUserSettings = async (settings: UserSettingsPayload) => {
  return client.patch("/api/users/settings", settings);
};

/** GET /api/users/me — current user (profile, settings, privacy); exclude password. */
export const getCurrentUser = async () => {
  const res = await client.get<Record<string, unknown>>("/api/users/me");
  return res.data;
};

export const updateUserPrivacy = async (privacy: UserPrivacyPayload) => {
  return client.patch("/api/users/privacy", privacy);
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  return client.post("/api/users/change-password", { currentPassword, newPassword });
};

export interface UserPermissionsPayload {
  camera?: boolean;
  photos?: boolean;
  location?: boolean;
  notifications?: boolean;
  microphone?: boolean;
}

export const getUserPermissions = async (): Promise<UserPermissionsPayload> => {
  const res = await client.get<{ permissions: UserPermissionsPayload }>("/api/users/permissions");
  return res.data.permissions;
};

export const updateUserPermissions = async (permissions: UserPermissionsPayload) => {
  return client.patch("/api/users/permissions", permissions);
};
