/**
 * Central content access layer.
 *
 * All site copy lives in `src/data/content.json` so it can be edited without
 * touching components. Add a certificate by appending one object to
 * `content.certificates.items` — no code changes required.
 */
import contentJson from "../data/content.json";

export interface NavItem {
  label: string;
  href: string;
}

export interface SiteData {
  title: string;
  description: string;
  keywords: string;
  lang: string;
  ogLocale: string;
  country: string;
  url: string;
  city: string;
  brandName: string;
  logo: string;
  hero: { image: string };
  nav: NavItem[];
  cta: { title: string; subtitle: string };
  footer: { note: string; copyright: string };
}

export interface UiLabels {
  homeLinkLabel: string;
  mainNavLabel: string;
  mobileNavLabel: string;
  menuLabel: string;
  closeLabel: string;
  prevImageLabel: string;
  nextImageLabel: string;
  faqTitle: string;
  telegramLabel: string;
  whatsappLabel: string;
}

export interface TopicsData {
  title: string;
  note: string;
  items: { title: string; text: string }[];
}

export interface PersonSection {
  title: string;
  paragraphs?: string[];
  list?: { title: string; items: string[] };
  facts?: string[];
}

export interface PersonFaqItem {
  question: string;
  answer: string;
}

export interface AppointmentStep {
  title: string;
  text: string;
}

export interface Person {
  name: string;
  shortName: string;
  role: string;
  badge: string | null;
  photo: string;
  cardPhotoPosition?: string;
  seoDescription: string;
  phone: string;
  phoneDisplay: string;
  telegram: string;
  whatsapp: string;
  intro: string[];
  approach: string | null;
  facts: string[];
  sections: PersonSection[];
  faq?: PersonFaqItem[];
  education: {
    title: string;
    base: string;
    experienceTitle: string;
    experience: string[];
    additionalTitle: string;
    additional: string[];
  };
  appointment: {
    title: string;
    steps: AppointmentStep[];
  };
  telegramChannel?: {
    title: string;
    text?: string;
    buttonLabel: string;
    url: string;
    image: string;
    imageAlt?: string;
  };
}

export interface Certificate {
  src: string;
  title?: string;
}

export interface CertificatesData {
  title: string;
  hint: string;
  emptyNote: string;
  fallbackTitle: string;
  openLabel: string;
  items: Certificate[];
}

export interface ContentData {
  site: SiteData;
  ui: UiLabels;
  person: Person;
  topics: TopicsData;
  certificates: CertificatesData;
}

export const content = contentJson as unknown as ContentData;
export const site = content.site;
export const ui = content.ui;
export const person = content.person;
export const topics = content.topics;
export const certificates = content.certificates;

/**
 * Replace `{placeholder}` tokens in a config string with the supplied values.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
