import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { CourseCard, type Course } from "@/components/CourseCard";
import platformImage from "@/assets/platform-interface.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduStarter — Understand which SA university courses you may qualify for" },
      {
        name: "description",
        content:
          "EduStarter helps you match your NSC results with university course requirements and understand where you may qualify. Eligibility information is not a guarantee of admission.",
      },
      { property: "og:title", content: "EduStarter — Understand which SA university courses you may qualify for" },
      {
        property: "og:description",
        content:
          "Match your NSC results with university course requirements and understand where you may qualify. Eligibility information is not a guarantee of admission.",
      },
    ],
  }),
  component: Index,
});

const previewCourses: Course[] = [
  {
    institution: "Demo — Example University",
    name: "BSc Computer Science",
    summary: "Example: you meet the published entry requirement. This is not a guarantee of admission.",
    aps: 42,
    delta: "+5 Above",
    status: "qualify",
  },
  {
    institution: "Demo — Example University",
    name: "BA Law",
    summary: "Example: you are below the published requirement. Explore options like a re-mark or extended programme.",
    aps: 34,
    delta: "-2 Points",
    status: "almost",
  },
];

function Index() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-20 text-center md:pt-24">
        <div className="rise mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
          Early Prototype
        </div>
        <h1 className="rise mx-auto max-w-4xl text-balance font-display text-5xl font-semibold leading-[1.1] tracking-tight md:text-7xl [animation-delay:100ms]">
          Your NSC results are a <span className="italic text-primary">roadmap</span>, not a barrier.
        </h1>
        <p className="rise mx-auto mt-8 max-w-2xl text-pretty text-xl text-muted-foreground [animation-delay:200ms]">
          Match your NSC results with university course requirements and understand where you may qualify.
        </p>
        <div className="rise mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row [animation-delay:300ms]">
          <Link
            to="/signup"
            className="w-full rounded-2xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-xl shadow-primary/20 transition-transform hover:scale-[1.02] sm:w-auto"
          >
            Start My Assessment
          </Link>
          <Link
            to="/login"
            className="w-full rounded-2xl border border-border bg-card px-8 py-4 text-lg font-bold transition-colors hover:bg-secondary sm:w-auto"
          >
            Sign In
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl border-t border-border px-6 py-24">
        <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-xl">
            <h2 className="mb-4 font-display text-3xl font-semibold">Clear status, zero guesswork</h2>
            <p className="text-muted-foreground">
              EduStarter will translate published university entry requirements into three simple categories: qualify, almost qualify, and don't qualify.
            </p>
          </div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Demo Preview / 01
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {previewCourses.map((course) => (
            <CourseCard key={course.name} course={course} />
          ))}

          <div className="flex flex-col items-center justify-center rounded-[2rem] border border-transparent bg-surface-muted p-8 text-center">
            <div className="mb-4 grid size-16 place-items-center rounded-full bg-card shadow-sm">
              <div className="size-8 rounded-lg border-2 border-dashed border-border" />
            </div>
            <h3 className="mb-2 font-display text-xl font-semibold">Your Dashboard</h3>
            <p className="px-4 text-sm text-muted-foreground">
              Sign up to save your results and explore how EduStarter will work.
            </p>
            <Link to="/signup" className="mt-6 text-sm font-bold text-primary underline underline-offset-4">
              Create Profile
            </Link>
          </div>
        </div>
      </section>

      <section id="universities" className="bg-foreground py-24 text-background">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 md:grid-cols-2 md:gap-24">
          <img
            src={platformImage}
            alt="Demo preview of the EduStarter dashboard concept"
            width={1200}
            height={1008}
            loading="lazy"
            className="aspect-square w-full rounded-3xl object-cover outline outline-1 -outline-offset-1 outline-background/10"
          />
          <div>
            <h2 className="mb-8 font-display text-4xl font-semibold leading-tight">
              One profile. <br />
              Your future options.
            </h2>
            <div className="space-y-12">
              <div className="flex gap-6">
                <div className="font-display text-3xl italic text-primary">01</div>
                <div>
                  <h3 className="mb-2 text-lg font-bold">Smart APS Calculator</h3>
                  <p className="text-background/60">
                    Input your marks once. EduStarter will help you compare your APS against published course requirements.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="font-display text-3xl italic text-primary">02</div>
                <div>
                  <h3 className="mb-2 text-lg font-bold">Pathway Support</h3>
                  <p className="text-background/60">
                    Didn't get the marks you need? EduStarter will suggest bridge programmes and TVET alternatives to explore.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
