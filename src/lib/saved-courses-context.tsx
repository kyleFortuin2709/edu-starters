import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { fetchSavedCourseIds, saveCourse, unsaveCourse } from "@/lib/saved-courses";

type SavedCoursesValue = {
  savedIds: Set<string>;
  ready: boolean;
  isSaved: (courseId: string) => boolean;
  toggle: (courseId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const SavedCoursesContext = createContext<SavedCoursesValue | null>(null);

export function SavedCoursesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setSavedIds(new Set());
      setReady(false);
      return;
    }
    try {
      setSavedIds(await fetchSavedCourseIds(user.id));
    } catch {
      setSavedIds(new Set());
    }
    setReady(true);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (courseId: string) => {
      if (!user) return;
      const saved = savedIds.has(courseId);
      // optimistic
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (saved) next.delete(courseId);
        else next.add(courseId);
        return next;
      });
      try {
        if (saved) await unsaveCourse(user.id, courseId);
        else await saveCourse(user.id, courseId);
      } catch {
        await refresh();
      }
    },
    [user, savedIds, refresh],
  );

  const value = useMemo(
    () => ({ savedIds, ready, isSaved: (id: string) => savedIds.has(id), toggle, refresh }),
    [savedIds, ready, toggle, refresh],
  );

  return <SavedCoursesContext.Provider value={value}>{children}</SavedCoursesContext.Provider>;
}

export function useSavedCourses(): SavedCoursesValue {
  return (
    useContext(SavedCoursesContext) ?? {
      savedIds: new Set<string>(),
      ready: false,
      isSaved: () => false,
      toggle: async () => {},
      refresh: async () => {},
    }
  );
}
