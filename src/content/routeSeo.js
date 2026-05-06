import { getInsightRouteMetaEntries } from "./insights";

export const TALENT_ROUTE_META = {
  title: "Model Portfolio | Meet Serenity",
  description: "View portfolio details from Meet Serenity by SmithInc.",
  robots: "index, follow",
};

export const DEFAULT_META = {
  title: "Meet Serenity - Talent Management",
  description: "Meet Serenity by SmithInc helps manage talent growth, bookings, and consulting workflows.",
};

export const PUBLIC_ROUTE_META = {
  "/": {
    title: "Meet Serenity - Fashion Consulting & Model Development",
    description: "Meet Serenity is SmithInc's model development and fashion consulting platform with coaching tiers, booking support, and talent growth pathways.",
    robots: "index, follow",
  },
  "/model-development": {
    title: "Model Development Program | Meet Serenity",
    description: "Explore Starter, Growth, and Elite model development tiers from SmithInc with coaching, positioning, and accountability.",
    robots: "index, follow",
  },
  "/model-signup": {
    title: "Apply to the Program | Meet Serenity",
    description: "Apply to SmithInc's model development program and submit your profile for review.",
    robots: "index, follow",
  },
  "/book": {
    title: "Book a Consultation | Meet Serenity",
    description: "Book a fashion consulting consultation with SmithInc and share your goals, company, and preferred timing.",
    robots: "index, follow",
  },
  "/partner-submit": {
    title: "Partner Submission | Meet Serenity",
    description: "Submit a partner request to source talent and collaborate with SmithInc campaigns.",
    robots: "index, follow",
  },
  "/brand-ambassador-submit": {
    title: "Brand Ambassador Submission | Meet Serenity",
    description: "Apply to become a SmithInc brand ambassador and collaborate on campaign opportunities.",
    robots: "index, follow",
  },
  "/contact-team": {
    title: "Contact Team | Meet Serenity",
    description: "Contact the SmithInc team for support, partnerships, and booking questions.",
    robots: "index, follow",
  },
  ...getInsightRouteMetaEntries(),
  "/login": {
    title: "Team Login | Meet Serenity",
    description: "Secure team login for Meet Serenity operations.",
    robots: "noindex, nofollow",
  },
};

export const BOOKING_FAQ_ENTITIES = [
  {
    "@type": "Question",
    name: "How do I book a consultation with Meet Serenity?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Visit the booking page, submit your name, email, company, service type, and preferred date. The team reviews and confirms availability quickly.",
    },
  },
  {
    "@type": "Question",
    name: "Can I talk to Serenity before booking?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Yes. You can use the Talk to Serenity voice option on the booking page to ask questions and get guidance before submitting.",
    },
  },
  {
    "@type": "Question",
    name: "What services can I request?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "You can request model booking support, creative direction, photoshoots, and consultation services.",
    },
  },
];

export const MODEL_DEVELOPMENT_FAQ_ENTITIES = [
  {
    "@type": "Question",
    name: "Is SmithInc a modeling agency?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "No. SmithInc is a fashion consulting and model development business focused on readiness, positioning, and structured growth.",
    },
  },
  {
    "@type": "Question",
    name: "What program tiers are available?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Meet Serenity offers Starter, Growth, and Elite tiers with different depth of coaching and accountability.",
    },
  },
  {
    "@type": "Question",
    name: "How do I apply to the model development program?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Use the Apply for the program button, complete your submission details, and upload your photo for review.",
    },
  },
];