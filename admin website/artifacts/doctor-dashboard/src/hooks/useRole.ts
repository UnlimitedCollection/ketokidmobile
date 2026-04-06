import { useGetMe } from "@workspace/api-client-react";

export function useRole(): "admin" | "moderator" | null {
  const { data: user } = useGetMe();
  if (!user?.role) return null;
  return user.role as "admin" | "moderator";
}

export function useIsAdmin(): boolean {
  return useRole() === "admin";
}

export function useIsModerator(): boolean {
  return useRole() === "moderator";
}

export function useCanWrite(): boolean {
  return useRole() === "admin";
}
