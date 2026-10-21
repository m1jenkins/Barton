# Email MTA-STS policy (2026-10-21)

MTA-STS tells other mail servers to deliver mail for `driverightcarbuying.com` only over verified TLS to the Zoho MX hosts.

## What the repo serves

- Policy file: `.well-known/mta-sts.txt` (from Zoho Mail's MTA-STS setup). It must list every MX host; today that is `mx.zoho.com`, `mx2.zoho.com` and `mx3.zoho.com`.
- Required URL: `https://mta-sts.driverightcarbuying.com/.well-known/mta-sts.txt`.
- `vercel.json` sends the file as `text/plain` with `noindex`, and 308-redirects every other path on the `mta-sts` host to `www`, so the subdomain never serves a copy of the site. `scripts/check-redirects.mjs --config-only` guards that redirect.

## Outside the repo

1. Vercel: `mta-sts.driverightcarbuying.com` is a domain on the site's project.
2. Cloudflare DNS: `CNAME mta-sts` pointing to Vercel (the target Vercel shows for the domain).
3. Cloudflare DNS: `TXT _mta-sts` with `v=STSv1; id=<new value>`. Change `id` (for example to a date like `20261021`) every time the policy file changes, or senders keep the old policy for up to `max_age` (604800 seconds, one week).
4. Optional reporting: `TXT _smtp._tls` with `v=TLSRPTv1; rua=mailto:<address>`.

## Changing mail providers

Before switching MX hosts, set `mode: testing` (or add the new hosts), publish, bump the `_mta-sts` id, and wait out `max_age`. With `mode: enforce`, senders refuse to deliver to an MX host the cached policy does not list.
