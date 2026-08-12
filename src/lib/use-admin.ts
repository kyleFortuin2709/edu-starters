import { useEffect, useState } from "react";
import { isAdmin } from "@/lib/admin";
import { useAuth } from "@/lib/auth";

/** True only when the signed-in user holds the admin role in the database. */
export function useIsAdmin(): { isAdmin: boolean; checked: boolean } {
  const { user } = useAuth();
  const [admin, setAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setAdmin(false);
      setChecked(true);
      return;
    }
    setChecked(false);
    isAdmin(user.id)
      .then((value) => {
        if (!active) return;
        setAdmin(value);
        setChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setAdmin(false);
        setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return { isAdmin: admin, checked };
}
