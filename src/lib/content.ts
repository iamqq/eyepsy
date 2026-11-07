/**
 * Central content access layer.
 *
 * All copy lives in the JSON files under `src/data/` so it can be edited
 * without touching components. Add a certificate by appending one object to
 * `src/data/certificates/ulyana.json` — no code changes required.
 */
import siteJson from "../data/site.json";
import topicsJson from "../data/topics.json";
import ulyanaJson from "../data/people/ulyana.json";
import ulyanaCerts from "../data/certificates/ulyana.json";

export interface NavItem {
  label: string;
  href: string;
}

export interface Contact {
  name: string;
  fullName: string;
  phone: string;
  phoneDisplay: string;
  telegram: string;
  whatsapp: string;
}

export interface SiteData {
  title: string;
  description: string;
  keywords: string;
  lang: string;
  url: string;
  city: string;
  hero: { title: string; quote: string; quoteAuthor: string; image: string };
  nav: NavItem[];
  cta: { title: string; subtitle: string };
  contacts: Contact[];
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

export interface Person {
  slug: string;
  name: string;
  role: string;
  cardRole: string;
  badge: string | null;
  photo: string;
  cardPhotoPosition?: string;
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
    base: string;
    experienceTitle: string;
    experience: string[];
    additionalTitle: string;
    additional: string[];
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

export const site = siteJson as SiteData;
export const topics = topicsJson as TopicsData;
export const person = ulyanaJson as unknown as Person;
export const certificates = ulyanaCerts as Certificate[];

export function getPerson(slug: string): Person | undefined {
  return slug === person.slug ? person : undefined;
}
