import { useEffect, useState } from "react";

export interface Identity {
  customerCode: string;
  customerName: string;
  customerEmail: string;
  /** Platform user id (`/users/self` → `user.id`) of the signed-in user. */
  userId: number | null;
  /** Login name of the signed-in user. */
  userName: string;
  /** Order editing is B2B-only, so the Orders page needs this. */
  isB2b: boolean;
}

export interface IdentityState {
  identity: Identity | null;
  loading: boolean;
  error: string;
}

/**
 * The signed-in B2B customer, from the same /users/self the storefront
 * account pages use. `customerCode` is the key every return is filed under.
 */
export function useIdentity(): IdentityState {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const self = await cb.platform.customer().getUserSelf();
        if (!active) return;
        const user = self?.user;
        if (!user) {
          setError("Please sign in to view your orders and returns.");
          return;
        }
        setIdentity({
          customerCode: user.customer?.customerCode ?? "",
          customerName: user.customer?.name ?? "",
          customerEmail: user.email ?? user.customer?.email ?? "",
          userId: typeof user.id === "number" ? user.id : null,
          userName: user.username ?? "",
          isB2b: Boolean(user.isB2b),
        });
      } catch (e: any) {
        if (active) setError(e?.message ?? "Could not load your account.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { identity, loading, error };
}
