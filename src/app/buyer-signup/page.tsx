import { redirect } from "next/navigation";

// Buyer sign-up now lives on the shared /signup page (with the buyer
// path pre-selected). Kept as a redirect so old links and bookmarks
// still work.
export default function BuyerSignupRedirect() {
  redirect("/signup?role=buyer");
}
