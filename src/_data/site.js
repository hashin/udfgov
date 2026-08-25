module.exports = {
  title: "UDF Kerala",
  tagline: "Initiatives & Achievements of the UDF Government",
  url: "https://www.udfgov.cc",
  defaultImage: "/static/images/default-og.png",
  // Set via the GA_MEASUREMENT_ID environment variable in Netlify (Site
  // configuration -> Environment variables) so it never needs a code change.
  // Empty until set, in which case no GA script is loaded at all.
  gaId: process.env.GA_MEASUREMENT_ID || "",
  // Appended below the title/summary/link in the WhatsApp share message only
  // (not Facebook/Instagram) -- promotes the WhatsApp channel to whoever
  // receives a shared article. Edit here to change it everywhere at once,
  // since src/_includes/share-bar.njk is the only place it's used.
  whatsappChannelPromo:
    "👋 UDF ചാനലിലേക്ക് സ്വാഗതം!\n\n" +
    "UDF സർക്കാർ തീരുമാനങ്ങൾ, വികസന-ക്ഷേമ പ്രവർത്തനങ്ങൾ, ജനകീയ ഇടപെടലുകൾ, ഏറ്റവും പുതിയ വാർത്തകളും അപ്‌ഡേറ്റുകളും എത്രയും വേഗം നേരിട്ട് അറിയാം, പങ്കുവെയ്ക്കാം.\n\n" +
    "📲 ചാനൽ Follow ചെയ്യൂ, വിവരങ്ങൾ മറ്റുള്ളവരിലേക്കും എത്തിക്കൂ.\n\n" +
    "👉 https://whatsapp.com/channel/0029Vb8V88BKGGGFkXT52d1o",
};
