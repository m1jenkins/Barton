// A listing's photos and details as car search stores them in deal_listings
// (db/013) and the buyer's Deal Tracker shows them (adr/0003). Shared by
// car-search.js, which checks a submission, and deal-tracker.js, which reads it.

// The listing details the page may show, by the key car search stores them
// under in deal_listings.details, with the label shown.
export const DETAIL_FIELDS = Object.freeze([
  ['trim', 'Trim'], ['body_type', 'Body'], ['drivetrain', 'Drivetrain'], ['engine', 'Engine'],
  ['transmission', 'Transmission'], ['fuel_type', 'Fuel'], ['mpg', 'MPG'], ['interior_color', 'Interior'],
  ['seats', 'Seats'], ['doors', 'Doors']
]);
export const MAX_FEATURES = 40;
export const MAX_PHOTOS = 20;

// A photo URL the server may fetch for the page: https, a host name rather than
// an address, no login in it (adr/0003).
export function photoUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.startsWith('[') || host === 'localhost' || host.endsWith('.localhost')
      || host.endsWith('.internal') || host.endsWith('.local')) return null;
    return url.href;
  } catch { return null; }
}

