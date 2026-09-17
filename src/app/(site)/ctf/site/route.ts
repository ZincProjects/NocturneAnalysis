import { intranetPage } from "./intranet";

export function GET() {
  return intranetPage(
    "Home",
    `<h1>Welcome to the staff intranet</h1>
<p>Everything you need for the semester, in one place.</p>
<h2 id="news">News</h2>
<ul>
  <li><b>12 Apr</b> - The staff portal will be unavailable Saturday 02:00-04:00 for planned maintenance.</li>
  <li><b>10 Apr</b> - Reminder: IT will <i>never</i> ask for your password by email.</li>
  <li><b>03 Apr</b> - The cyber lab is booked for the Nocturne CTF warm-up next week.</li>
</ul>
<h2 id="it">IT Services</h2>
<ul>
  <li>Password resets: extension 4357 (HELP)</li>
  <li>Printer on level 2: please do not kick it</li>
  <li>Our pages are hidden from search engines to keep internal documents private.</li>
</ul>`,
  );
}
