import { useEffect, useState } from "react";

export interface AdminIdentity {
  name: string;
  email: string;
}

export interface AdminIdentityState {
  identity: AdminIdentity;
  /** False once the lookup has settled (either way). */
  loading: boolean;
}

const FALLBACK: AdminIdentity = { name: "Admin", email: "" };

/**
 * The signed-in admin, for attributing history entries and notes.
 * `cb.platform` is authenticated as the admin, so /users/self describes
 * them. Never blocks an action — falls back to "Admin" on any failure.
 */
export function useAdminIdentity(): AdminIdentityState {
  const [state, setState] = useState<AdminIdentityState>({
    identity: FALLBACK,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      let identity = FALLBACK;
      try {
        const self = await cb.platform.customer().getUserSelf();
        const user: any = self?.user;
        if (user) {
          const email = String(user.email ?? user.contactEmail ?? "");
          const fullName = [user.firstName, user.lastName]
            .filter(Boolean)
            .join(" ");
          identity = {
            name: String(user.username || fullName || email || FALLBACK.name),
            email,
          };
        }
      } catch {
        // Keep the fallback.
      }
      if (active) setState({ identity, loading: false });
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
