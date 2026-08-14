/** Plain-language explanations for terms a new student may not know. */
export const GLOSSARY: Record<string, string> = {
  aps: "Admission Point Score — a number worked out from your subject marks. Each university has its own way of turning marks into points.",
  "admission point score":
    "A number worked out from your subject marks. Universities use it to decide who meets the minimum entry level.",
  nsc: "National Senior Certificate — the matric qualification you get at the end of Grade 12.",
  matric: "Grade 12, the final year of school. Your matric results decide what you can study.",
  "bachelor's pass":
    "The highest NSC pass level. It is the minimum you need to study a degree at a university.",
  "bachelor pass":
    "The highest NSC pass level. It is the minimum you need to study a degree at a university.",
  "diploma pass":
    "An NSC pass level that lets you study a diploma, but not usually a full degree.",
  prospectus:
    "The official booklet a university publishes each year listing its courses, requirements and dates.",
  faculty:
    "A department grouping of related courses at a university, such as Health Sciences or Commerce.",
  qualification:
    "The type of certificate you graduate with — for example a Higher Certificate, Diploma, Degree or Honours.",
  undergraduate: "Your first qualification after school, before any postgraduate study.",
  postgraduate: "Study you do after finishing your first degree, such as Honours or a Master's.",
  honours: "A one-year postgraduate degree you can do after a three-year bachelor's degree.",
  eligibility:
    "Whether you meet the published minimum requirements. It is not a promise of a place — spaces are limited.",
  "entry requirements":
    "The minimum marks, subjects and pass level a university asks for before it will consider your application.",
  prerequisite: "A subject or result you must already have before you may take a course.",
  "designated subject":
    "A school subject from an approved list that counts towards university admission.",
  "life orientation":
    "A compulsory school subject. Many universities leave it out, or only partly count it, when working out your APS.",
  nbt: "National Benchmark Tests — extra written tests some universities ask applicants to write.",
  nsfas: "The government scheme that funds tuition and living costs for students from low-income households.",
  bursary: "Money for your studies that you do not pay back, usually with conditions attached.",
  "closing date": "The last day a university will accept your application for that year.",
  "conditional offer":
    "A place you are offered on condition that your final results meet a stated level.",
  credits: "A measure of how much work a module counts for towards your qualification.",
  module: "A single subject or unit you take within a course.",
  "residence": "University-run student accommodation, often called res.",
  "registration": "The step where you formally sign up for your modules and become a student for the year.",
};

const KEYS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

/** Case-insensitive whole-phrase matcher for all glossary terms. */
export const GLOSSARY_PATTERN = new RegExp(
  `\\b(${KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);

export function lookupGlossary(term: string): string | undefined {
  return GLOSSARY[term.trim().toLowerCase()];
}
