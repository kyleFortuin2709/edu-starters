import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ActionButton } from "@/components/ActionButton";
import { FormMessage } from "@/components/FormMessage";
import { useAuth } from "@/lib/auth";
import {
  deleteConversation,
  fetchMyConversations,
  type AdvisorConversation,
} from "@/lib/advisor-conversations";

export const Route = createFileRoute("/_authenticated/conversations")({
  head: () => ({
    meta: [
      { title: "Saved conversations — EduStarter" },
      {
        name: "description",
        content:
          "Revisit and continue your saved AI course advisor conversations, grouped by faculty.",
      },
      { property: "og:title", content: "Saved conversations — EduStarter" },
      {
        property: "og:description",
        content: "Your past AI course advisor chats, organised per course and faculty.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConversationsPage,
});

function ConversationsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AdvisorConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchMyConversations(user.id)
      .then((rows) => {
        if (!active) return;
        setConversations(rows);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't load your saved conversations. Please refresh the page.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const groups = useMemo(() => {
    const map = new Map<string, AdvisorConversation[]>();
    for (const conversation of conversations) {
      const key = conversation.facultyName ?? conversation.universityName ?? "Other courses";
      map.set(key, [...(map.get(key) ?? []), conversation]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [conversations]);

  async function remove(courseId: string) {
    if (!user) return;
    setConversations((prev) => prev.filter((c) => c.courseId !== courseId));
    try {
      await deleteConversation(user.id, courseId);
    } catch {
      setError("We couldn't delete that conversation. Please try again.");
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Course advisor
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
          Saved conversations
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Every chat you have with the AI course advisor is saved per course, grouped by faculty.
          Open one to pick up where you left off.
        </p>

        {error ? (
          <div className="mt-6">
            <FormMessage>{error}</FormMessage>
          </div>
        ) : null}

        {loading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading your conversations…</p>
        ) : conversations.length === 0 ? (
          <div className="mt-10 rounded-[2rem] border border-border bg-card p-8">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquare className="size-6" />
            </div>
            <h2 className="mt-6 font-display text-xl font-semibold">No conversations yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Open any course match and ask the advisor a question — the chat will show up here.
            </p>
            <Link to="/matches" className="mt-6 inline-block">
              <ActionButton>View my course matches</ActionButton>
            </Link>
          </div>
        ) : (
          <div className="mt-10 space-y-12">
            {groups.map(([category, items]) => (
              <div key={category}>
                <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
                  <h2 className="font-display text-2xl font-semibold">{category}</h2>
                  <span className="font-mono text-xs uppercase text-muted-foreground">
                    {items.length} conversation{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="mt-6 grid gap-4 md:grid-cols-2">
                  {items.map((conversation) => {
                    const last = conversation.messages[conversation.messages.length - 1];
                    return (
                      <li
                        key={conversation.id}
                        className="rounded-[2rem] border border-border bg-card p-6"
                      >
                        <p className="font-mono text-xs uppercase text-muted-foreground">
                          {conversation.universityName ?? "Institution"}
                        </p>
                        <h3 className="mt-2 font-display text-xl font-semibold">
                          {conversation.courseName}
                        </h3>
                        {last ? (
                          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                            {last.role === "user" ? "You: " : "Advisor: "}
                            {last.content}
                          </p>
                        ) : null}
                        <p className="mt-4 font-mono text-[11px] uppercase text-muted-foreground">
                          {conversation.messages.length} message
                          {conversation.messages.length === 1 ? "" : "s"} ·{" "}
                          {new Date(conversation.updatedAt).toLocaleDateString()}
                        </p>
                        <div className="mt-5 flex items-center gap-3">
                          <Link
                            to="/matches/$courseId"
                            params={{ courseId: conversation.courseId }}
                          >
                            <ActionButton variant="outline">Continue chat</ActionButton>
                          </Link>
                          <button
                            type="button"
                            onClick={() => void remove(conversation.courseId)}
                            aria-label={`Delete conversation about ${conversation.courseName}`}
                            className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
