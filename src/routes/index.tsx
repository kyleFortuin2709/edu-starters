import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { CourseCard, type Course } from "@/components/CourseCard";
import {
  FileText,
  Calculator,
  CheckCircle2,
  Compass,
  Building2,
  BookOpen,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import platformImage from "@/assets/platform-interface.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduStarter — Find South African university courses you qualify for" },
      {
        name: "description",
        content:
          "EduStarter helps South African students match their NSC results with university course requirements and discover where they may qualify. Eligibility information is not a guarantee of admission.",
      },
      { property: "og:title", content: "EduStarter — Find South African university courses you qualify for" },
      {
        property: "og:description",
        content:
          "Match your NSC results with university course requirements and discover where you may qualify. Eligibility information is not a guarantee of admission.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/profile" });
  },
  component: Index,
});

const previewCourses: Course[] = [
  {
    institution: "Example University",
    name: "BSc Computer Science",
    summary: "Example: you meet the published entry requirement. This is not a guarantee of admission.",
    aps: 42,
    delta: "+5 Above",
    status: "qualify",
  },
  {
    institution: "Example University",
    name: "BA Law",
    summary: "Example: you are below the published requirement. Explore options like a re-mark or extended programme.",
    aps: 34,
    delta: "-2 Points",
    status: "almost",
  },
];

const howItWorksSteps = [
  {
    icon: FileText,
    title: "Add your results",
    description: "Enter your NSC subjects and marks once. Your data stays private and secure.",
  },
  {
    icon: Calculator,
    title: "APS calculations",
    description: "We calculate institution-specific APS scores from the same results, because every university does it differently.",
  },
  {
    icon: CheckCircle2,
    title: "Eligibility matching",
    description: "Compare your marks and APS against each course's published requirements, subject by subject.",
  },
  {
    icon: Compass,
    title: "Explore your options",
    description: "See where you qualify, where you're close, and what steps could open more doors.",
  },
];

const differentiators = [
  {
    icon: Building2,
    title: "Institution-specific APS",
    description: "Different universities calculate APS differently. EduStarter applies the right rule to each course.",
  },
  {
    icon: BookOpen,
    title: "Subject requirement matching",
    description: "We check minimum subject percentages and required combinations, not just the overall score.",
  },
  {
    icon: TrendingUp,
    title: "Almost qualify",
    description: "Find courses you're just below and understand exactly what would move you into the qualifying range.",
  },
  {
    icon: Sparkles,
    title: "AI-powered guidance",
    description: "Ask questions about a course, your gaps, and possible pathways without guessing.",
  },
  {
    icon: ShieldCheck,
    title: "Human-verified source data",
    description: "University requirements are staged and reviewed before they reach your results.",
  },
];

function Index() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-24 md:pt-32">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[1200px] -translate-x-1/2">
            <div className="absolute left-[10%] top-20 h-72 w-72 rounded-full bg-accent/20 blur-3xl animate-blob" />
            <div className="absolute right-[10%] top-20 h-72 w-72 rounded-full bg-warning/20 blur-3xl animate-blob animation-delay-2000" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-primary/15 blur-3xl animate-blob animation-delay-4000" />
          </div>
        </div>

        <div className="mx-auto max-w-4xl text-center">

          <h1 className="rise font-display text-5xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-7xl [animation-delay:100ms]">
            Discover SA university courses you may{" "}
            <span className="italic text-primary">qualify</span> for.
          </h1>

          <p className="rise mx-auto mt-8 max-w-2xl text-pretty text-xl text-muted-foreground [animation-delay:200ms]">
            EduStarter matches your NSC results with published course requirements — so you can see your options, plan your next step, and apply with confidence.
          </p>

          <div className="rise mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row [animation-delay:300ms]">
            <Link
              to="/signup"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 sm:w-auto"
            >
              Find My Options
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="/#how-it-works"
              className="w-full rounded-2xl border border-border bg-card px-8 py-4 text-lg font-bold text-foreground transition-colors hover:bg-secondary sm:w-auto"
            >
              How it works
            </a>
          </div>

          <p className="rise mt-4 text-sm text-muted-foreground [animation-delay:400ms]">
            Free for students. No credit card required.
          </p>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="bg-surface-muted px-6 py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="order-2 md:order-1">
            <img
              src={platformImage.url}
              alt="A young South African student on a university campus, ready to explore course options"
              width={1200}
              height={1008}
              loading="lazy"
              className="aspect-square w-full rounded-3xl object-cover outline outline-1 -outline-offset-1 outline-border/50"
            />
          </div>
          <div className="order-1 md:order-2">
            <span className="mb-4 inline-block font-mono text-xs font-bold uppercase tracking-widest text-primary">
              The challenge
            </span>
            <h2 className="font-display text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              Too many options. Too little clarity.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              South African students often apply to universities without knowing exactly what they qualify for. Published requirements are scattered across websites, APS calculations differ between institutions, and the path forward feels uncertain.
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              EduStarter brings those requirements into one place and shows you — clearly — where you stand.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-16 max-w-2xl">
          <span className="mb-4 inline-block font-mono text-xs font-bold uppercase tracking-widest text-primary">
            How it works
          </span>
          <h2 className="font-display text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            From your NSC results to your course list
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            A simple, four-step flow that turns your marks into a clear picture of where you could study.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorksSteps.map((step, index) => (
            <div
              key={step.title}
              className="group relative rounded-3xl border border-border bg-card p-8 transition-all hover:border-primary/30 hover:shadow-lg"
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <step.icon className="size-6" />
                </div>
                <span className="font-display text-2xl italic text-muted-foreground/50">0{index + 1}</span>
              </div>
              <h3 className="mb-3 font-display text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Key differentiators */}
      <section id="features" className="bg-surface-muted px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-2xl">
            <span className="mb-4 inline-block font-mono text-xs font-bold uppercase tracking-widest text-primary">
              Why EduStarter
            </span>
            <h2 className="font-display text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              Built for South African students
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              The details that matter when you're deciding where to apply.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {differentiators.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-3xl border border-border bg-card p-8 transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <feature.icon className="size-6" />
                </div>
                <h3 className="mb-3 font-display text-xl font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-xl">
            <span className="mb-4 inline-block font-mono text-xs font-bold uppercase tracking-widest text-primary">
              Preview
            </span>
            <h2 className="font-display text-3xl font-semibold leading-tight text-foreground">
              See how your results could look
            </h2>
            <p className="mt-4 text-muted-foreground">
              These are example results only. Real outcomes depend on your marks and the course requirements.
            </p>
          </div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Example data</div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {previewCourses.map((course) => (
            <CourseCard key={course.name} course={course} />
          ))}

          <div className="flex flex-col items-center justify-center rounded-[2rem] border border-transparent bg-secondary p-8 text-center">
            <div className="mb-4 grid size-16 place-items-center rounded-full bg-card shadow-sm">
              <div className="size-8 rounded-lg border-2 border-dashed border-border" />
            </div>
            <h3 className="mb-2 font-display text-xl font-semibold text-foreground">Your profile</h3>
            <p className="px-4 text-sm text-muted-foreground">
              Sign up to save your results and explore how EduStarter works.
            </p>
            <Link
              to="/signup"
              className="mt-6 text-sm font-bold text-primary underline underline-offset-4"
            >
              Create Profile
            </Link>
          </div>
        </div>
      </section>

      {/* Strong CTA */}
      <section id="cta" className="px-6 py-24">
        <div className="mx-auto max-w-4xl rounded-[2.5rem] bg-foreground p-12 text-center text-background md:p-20">
          <span className="mb-4 inline-block font-mono text-xs font-bold uppercase tracking-widest text-primary">
            Start exploring
          </span>
          <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            Ready to find your options?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-background/70">
            Create your free profile, add your NSC results, and see where you may qualify across South African universities.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 sm:w-auto"
            >
              Find My Options
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/login"
              className="w-full rounded-2xl border border-background/20 bg-background/10 px-8 py-4 text-lg font-bold text-background backdrop-blur transition-colors hover:bg-background/20 sm:w-auto"
            >
              Sign In
            </Link>
          </div>
          <p className="mt-6 text-sm text-background/50">
            Eligibility information is not a guarantee of admission. Always confirm with the institution.
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
