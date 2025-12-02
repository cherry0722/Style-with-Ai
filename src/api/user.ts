import client from "./client";

export interface UserProfilePayload {
  age: number;
  gender: string;
  heightCm: number;
  weightLb: number;
}

export const saveUserProfile = async (profile: UserProfilePayload) => {
  return client.post("/api/users/profile", profile);
};


