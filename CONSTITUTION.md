# The PublicWerx Constitution

**Version 1.0.0 -- March 20, 2026**

## Preamble

The default state of the internet is exploitation. Users are tracked, manipulated, and sold. Services that start honest are often acquired, gutted, and rebuilt around ad revenue. The patterns are so common they feel inevitable.

They are not inevitable. They are choices.

This constitution exists because we believe software can be built differently. Not as a pitch, not as marketing copy, but as a binding set of rules that any project can adopt and any user can hold it to.

Tenets are numbered by priority. When two tenets conflict, the higher-numbered tenet takes precedence. But this document is not carved in stone. Like the Zurich tram system that inspires it, what matters is the spirit, not rigid adherence to the letter. The tenets will evolve as the community and the technology evolve. What will not change is the commitment to building things that serve people honestly.

This constitution governs PublicWerx before it governs anyone else. We are the first adopter. Every rule here applies to us first. If we ask others to eat this cooking, we eat it ourselves.

If you are building something and you are tired of the way things work, this is for you.

## The 8 Tenets

### 1. Forever Service

This service will never be sold or acquired. Your data will never be handed to a new owner. We remain the stewards. This includes protection against governance capture -- no single entity should be able to gain control of the service through financial leverage. If we can no longer maintain the service, the codebase, data, and infrastructure will be transferred to the community under terms that preserve these tenets.

### 2. Users Are Not Products

We do not optimize for engagement metrics or "time spent." We optimize for utility. When you are done, go live your life. No ads -- no banners, no sponsored content, no attention-gating. No dark patterns -- no artificial scarcity, no FOMO mechanics, no manipulative notifications. We are funded by users, not advertisers.

### 3. Protect the Commons

The service must defend itself against abuse, exploitation, and bad actors. A trust-based system is not a naive one. Protecting the commons for the many is not at odds with serving the user -- it is a requirement of it. This tenet is never a justification for restricting access based on an inability or unwillingness to pay.

### 4. Core Access Is Free

Essential functionality is a right, not a tier. The free version must be a complete, genuinely useful service on its own -- not a crippled demo or a funnel. Revenue is derived solely from voluntary contributions or specialized features for power users. Premium features must be additive -- they add convenience or capability, they never remove artificial limits. If a user who never pays would not enthusiastically recommend the service to a friend, we have failed this tenet.

### 5. Data Minimization

Collect only what is vital. Default to "no collection." If in doubt, do not store it. Analytics, if any, must be opt-in. No data is collected from users who have not explicitly consented.

### 6. User-First UX

We do not ship features that benefit us at the cost of the user. If there is a conflict between our convenience and the user's experience, the user wins.

### 7. Radical Transparency

All changes that affect users -- data practices, pricing, features, policies -- are documented publicly and loudly. No quiet updates.

### 8. Stay Lean

Minimalist architecture, simple code, and no bloated abstractions. Build exactly what is needed to fulfill our commitment to the user -- nothing more.

## The Zurich Principle

In Zurich, the trams have no turnstiles. You simply walk on and ride. The system operates on the belief that access comes first.

PublicWerx takes that spirit and builds software around it.

- **Trust over enforcement.** Instead of wasting resources on paywalls and DRM "enforcement theater," we invest those resources into the service itself. Enforcement theater is a cost. We would rather spend that cost on making the thing better.
- **The free user is not a bug.** By keeping the core service free, the tool remains a public good. Those who can afford to pay do so to sustain the infrastructure for everyone.
- **The commons model.** Financial status should never dictate access to essential digital tools.

## The Principle of Unstoppable Access

The core requirement is that no middleman -- bank, processor, or gatekeeper -- should have the power to de-platform a project or its users.

Services adopting this charter should:

- Accept payment directly, without middlemen who can censor or revoke access
- Be transparent about all payment flows
- Store no payment data and charge no hidden fees
- Follow the spirit of the Zurich transit model: access first, no gates, funded voluntarily by those who can and choose to pay

We advocate for on-chain P2P payments (L2 networks, stablecoins) as the most robust way to achieve this today. But any method that preserves user sovereignty and prevents financial censorship is in the spirit of this constitution. We value censorship resistance over specific payment rails.

As long as the fair share provided by voluntary contributors covers lean operating costs, the service stays alive for the entire public.

## How to Adopt This Constitution

1. **Commit.** Ensure your project goals align with the eight tenets.
2. **Document.** Add a `CONSTITUTION.md` to your project repo referencing these rules. Include a succession plan -- what happens to your users and their data if you can no longer run the service (see [SUCCESSION.md](SUCCESSION.md) for a template). You may adapt the language to fit your domain. The words can change. The spirit cannot.
3. **Register.** Open a pull request on the [publicwerx repo](https://github.com/shettysuraj/publicwerx) to add your project to `CHARTER-ADOPTERS.md`.
4. **Uphold.** This is not a badge. It is a commitment to your users.

## Accountability

This constitution applies to PublicWerx itself. If any adopter -- including PublicWerx -- is found to be violating the tenets, the community can hold them accountable through the process documented in [CHARTER-ADOPTERS.md](CHARTER-ADOPTERS.md). No project is above the constitution it adopted.

## Versioning

This constitution is versioned using semantic versioning. Changes to the tenets require a major version bump and will be documented publicly with rationale.

- **v1.0.0** -- March 20, 2026 -- Initial publication.
