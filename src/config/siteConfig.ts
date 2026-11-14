export const siteConfig = {
  brandName: "Vellora Fine Dining",
  address: "123 Culinary Street, Foodie City",
  phoneDisplay: "(123) 456-7890",
  phoneHref: "tel:+11234567890",
  email: "hello@vellora-dining.com",
  emailHref: "mailto:hello@vellora-dining.com",
  hours: [
    "Mon-Thu: 5pm-10pm",
    "Fri-Sat: 5pm-11pm",
    "Sunday: 4pm-9pm",
  ],
  socialLinks: [
    { shortLabel: "IG", name: "Instagram", href: "#contact" },
    { shortLabel: "FB", name: "Facebook", href: "#contact" },
    { shortLabel: "WL", name: "Wine List & Updates", href: "#menu" },
  ],
} as const;
