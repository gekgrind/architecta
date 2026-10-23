import { LOGOUT_PATH } from "@/lib/auth/redirects";

/**
 * Signs out through the server route, as a top-level form POST.
 *
 * Deliberately no browser-side `supabase.auth.signOut()` first: it reads
 * the collapsed `document.cookie` view, revokes whichever generation
 * that shows, then deletes its cookies in the canonical scope only —
 * so the server route would no longer see the copies it must revoke
 * and expire in every scope. The route needs the browser's full cookie
 * inventory, untouched.
 *
 * A POST (never a GET link) so sign-out cannot be triggered by another
 * site; the route also checks the request's origin. Navigating as a
 * form keeps the route's Set-Cookie expiries and redirect authoritative.
 */
export function submitLogout(doc: Document = document) {
  const form = doc.createElement("form");

  form.method = "post";
  form.action = LOGOUT_PATH;
  form.style.display = "none";
  doc.body.appendChild(form);
  form.submit();
}
