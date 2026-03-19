# The PublicWerx Constitution

**Version 1.0.0 -- March 19, 2026**

## Preamble

The default state of the internet is exploitation. Users are tracked, manipulated, and sold. Services that start honest are often acquired, gutted, and rebuilt around ad revenue. The patterns are so common they feel inevitable.

They are not inevitable. They are choices.

This constitution exists because we believe software can be built differently. Not as a pitch, not as marketing copy, but as a binding set of rules that any project can adopt and any user can hold it to.

If you are building something and you are tired of the way things work, this is for you.

## The 10 Tenets

### 1. Forever Service

This service will never be sold or acquired. Your data will never be handed to a new owner. We remain the stewards. If we can no longer maintain the service, the codebase, data, and infrastructure will be transferred to the community under terms that preserve these tenets.

### 2. Users Are Not Products

We do not optimize for engagement metrics or "time spent." We optimize for utility. When you are done, go live your life.

### 3. Core Access Is Free

Essential functionality is a right, not a tier. Revenue is derived solely from voluntary contributions and optional power features.

### 4. Data Minimization

Collect only what is vital. Default to "no collection." If in doubt, do not store it.

### 5. No Dark Patterns

No artificial scarcity, no FOMO mechanics, and no manipulative notifications designed to pull you back in.

### 6. Zero Ads

No banners, no "sponsored content," and no attention-gating. We are funded by users, not advertisers.

### 7. Privacy-First Analytics

No silent tracking or invasive telemetry. Analytics, if any, must be opt-in. No data is collected from users who have not explicitly consented.

### 8. User-First UX

We do not ship features that benefit us at the cost of the user. If there is a conflict between our convenience and the user's experience, the user wins.

### 9. Radical Transparency

All changes that affect users -- data practices, pricing, features, policies -- are documented publicly and loudly. No quiet updates.

### 10. Stay Lean

Simple code, minimal infrastructure, and no bloated abstractions. Build exactly what is needed -- nothing more.

## The Zurich Principle

In Zurich, the trams have no turnstiles. You simply walk on and ride. The system operates on the belief that access comes first.

PublicWerx takes that spirit and builds software around it.

- **Trust over enforcement.** Instead of wasting resources on paywalls and DRM "enforcement theater," we invest those resources into the service itself. Enforcement theater is a cost. We would rather spend that cost on making the thing better.
- **The free user is not a bug.** By keeping the core service free, the tool remains a public good. Those who can afford to pay do so to sustain the infrastructure for everyone.
- **The commons model.** Financial status should never dictate access to essential digital tools.

## The Payment Philosophy

Payments should be peer-to-peer, transparent, and free of intermediaries. No payment provider should have the power to cut off access to the service.

Services adopting this charter should:

- Accept payment directly, without middlemen who can censor or revoke access
- Be transparent about all payment flows
- Store no payment data and charge no hidden fees
- Follow the spirit of the Zurich transit model: access first, no gates, funded voluntarily by those who can and choose to pay

As long as the fair share provided by voluntary contributors covers lean operating costs, the service stays alive for the entire public.

*Current recommended implementation: stablecoins (USDC, USDT) on EVM-compatible chains via standard open tooling. See the project README for technical details.*

## How to Adopt This Constitution

1. **Commit.** Ensure your project goals align with the ten tenets.
2. **Document.** Add a `CONSTITUTION.md` to your project repo referencing these rules. Include a succession plan -- what happens to your users and their data if you can no longer run the service. You may adapt the language to fit your domain. The words can change. The spirit cannot.
3. **Register.** Open a pull request on the [publicwerx repo](https://github.com/shettysuraj/publicwerx) to add your project to `CHARTER-ADOPTERS.md`.
4. **Uphold.** This is not a badge. It is a commitment to your users.

## Versioning

This constitution is versioned using semantic versioning. Changes to the tenets require a major version bump and will be documented publicly with rationale.

- **v1.0.0** -- March 19, 2026 -- Initial publication.
