import { z } from "zod";

export const ALLOWED_PLACEHOLDERS = ["city", "year", "title"];

const nonEmpty = z.string().trim().min(1, "must not be empty");
const url = z.string().trim().url("must be a valid URL");
const imagePath = z
  .string()
  .trim()
  .min(1, "must not be empty")
  .refine((value) => value.startsWith("/images/"), {
    message: "must start with /images/",
  });
const href = z
  .string()
  .trim()
  .min(1, "must not be empty")
  .refine((value) => value.startsWith("#") || value.startsWith("/"), {
    message: "must start with # or /",
  });

const placeholderText = z
  .string()
  .trim()
  .min(1, "must not be empty")
  .superRefine((value, ctx) => {
    for (const match of value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
      if (!ALLOWED_PLACEHOLDERS.includes(match[1])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `unknown placeholder {${match[1]}}; allowed: ${ALLOWED_PLACEHOLDERS.join(", ")}`,
        });
      }
    }
  });

const certificateOpenLabel = nonEmpty.refine(
  (value) => value.includes("{title}"),
  { message: "must contain the {title} placeholder" },
);

const navItem = z
  .object({
    label: nonEmpty,
    href,
  })
  .strict();

const site = z
  .object({
    title: nonEmpty,
    description: nonEmpty,
    keywords: nonEmpty,
    lang: nonEmpty,
    ogLocale: nonEmpty,
    country: nonEmpty,
    url,
    city: nonEmpty,
    brandName: nonEmpty,
    logo: imagePath,
    hero: z.object({ image: imagePath }).strict(),
    nav: z.array(navItem),
    cta: z
      .object({
        title: nonEmpty,
        subtitle: nonEmpty,
      })
      .strict(),
    footer: z
      .object({
        note: placeholderText,
        copyright: placeholderText,
      })
      .strict(),
  })
  .strict();

const ui = z
  .object({
    homeLinkLabel: nonEmpty,
    mainNavLabel: nonEmpty,
    mobileNavLabel: nonEmpty,
    menuLabel: nonEmpty,
    closeLabel: nonEmpty,
    prevImageLabel: nonEmpty,
    nextImageLabel: nonEmpty,
    faqTitle: nonEmpty,
    telegramLabel: nonEmpty,
    whatsappLabel: nonEmpty,
  })
  .strict();

const topics = z
  .object({
    title: nonEmpty,
    note: nonEmpty,
    items: z.array(
      z
        .object({
          title: nonEmpty,
          text: nonEmpty,
        })
        .strict(),
    ),
  })
  .strict();

const personSection = z
  .object({
    title: nonEmpty,
    paragraphs: z.array(nonEmpty).optional(),
    list: z
      .object({
        title: nonEmpty,
        items: z.array(nonEmpty),
      })
      .strict()
      .optional(),
    facts: z.array(nonEmpty).optional(),
  })
  .strict();

const personFaqItem = z
  .object({
    question: nonEmpty,
    answer: nonEmpty,
  })
  .strict();

const appointmentStep = z
  .object({
    title: nonEmpty,
    text: nonEmpty,
  })
  .strict();

const telegramChannel = z
  .object({
    title: nonEmpty,
    text: nonEmpty.optional(),
    buttonLabel: nonEmpty,
    url,
    image: imagePath,
    imageAlt: nonEmpty.optional(),
  })
  .strict();

const education = z
  .object({
    title: nonEmpty,
    base: nonEmpty,
    experienceTitle: nonEmpty,
    experience: z.array(nonEmpty),
    additionalTitle: nonEmpty,
    additional: z.array(nonEmpty),
  })
  .strict();

const person = z
  .object({
    name: nonEmpty,
    shortName: nonEmpty,
    role: nonEmpty,
    badge: nonEmpty.nullable(),
    photo: imagePath,
    cardPhotoPosition: nonEmpty.optional(),
    seoDescription: nonEmpty,
    phone: nonEmpty,
    phoneDisplay: nonEmpty,
    telegram: url,
    whatsapp: url,
    telegramChannel: telegramChannel.optional(),
    intro: z.array(nonEmpty),
    approach: nonEmpty.nullable(),
    facts: z.array(nonEmpty),
    sections: z.array(personSection),
    faq: z.array(personFaqItem).optional(),
    education,
    appointment: z
      .object({
        title: nonEmpty,
        steps: z.array(appointmentStep),
      })
      .strict(),
  })
  .strict();

const certificate = z
  .object({
    src: imagePath,
    title: nonEmpty.optional(),
  })
  .strict();

const certificates = z
  .object({
    title: nonEmpty,
    hint: nonEmpty,
    emptyNote: nonEmpty,
    fallbackTitle: nonEmpty,
    openLabel: certificateOpenLabel,
    items: z.array(certificate),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set();
    value.items.forEach((item, index) => {
      if (seen.has(item.src)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "src"],
          message: `duplicate certificate src: ${item.src}`,
        });
      }
      seen.add(item.src);
    });
  });

export const contentSchema = z
  .object({
    site,
    ui,
    person,
    topics,
    certificates,
  })
  .strict();
