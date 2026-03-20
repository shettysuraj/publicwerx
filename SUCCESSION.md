# Succession Plan Template

This template helps projects adopting the PublicWerx constitution fulfill Tenet 01 (Forever Service). Every adopter should include a completed version of this document in their repository.

This is a template, not a prescription. Adapt it to fit your project. What matters is that the plan exists, is public, and is honest.

---

## 1. The Trigger

Define what "can no longer run it" means for your project. Be specific.

Examples:
- The primary maintainer has been unresponsive for 6 months
- The project formally announces it is shutting down
- Operating costs exceed contributions for 12 consecutive months
- The maintainer is incapacitated or deceased

**Your trigger:**
> [Describe the specific conditions that activate this plan.]

## 2. The Custodian

Who gets the keys? This can be a person, an organization, or a technical mechanism.

Examples:
- A named individual with documented access credentials
- A GitHub organization with multiple trusted members
- A DAO with multisig governance
- A non-profit foundation

**Your custodian:**
> [Name the custodian and how they were chosen.]

## 3. The Handover

How does the transfer actually happen? What gets transferred and how?

Consider:
- **Code:** Where is the source? Who has push access? Is it already public?
- **Data:** How is user data handled? Is it exported, migrated, or deleted?
- **Infrastructure:** Domain names, servers, DNS, SSL certificates, API keys
- **Credentials:** How are secrets and access credentials passed securely?
- **Continuity:** Are there regular backups? Where are they stored?

**Your handover plan:**
> [Describe the specific steps for transferring each component.]

## 4. The Mandate

The successor must uphold the PublicWerx constitution. If they cannot or will not, the succession plan should specify what happens next.

Examples:
- The successor signs the constitution as a condition of receiving the project
- If no constitutional successor can be found, the code is archived publicly and user data is deleted
- The domain redirects to a public notice explaining what happened

**Your mandate:**
> [Describe the conditions the successor must meet and what happens if they cannot.]

## 5. Maintenance

This plan is only useful if it is current. Review it at least once a year.

- **Last reviewed:** [Date]
- **Next review:** [Date]
- **Reviewed by:** [Name]

---

## Example: Minimal Plan for a Solo Developer

> **Trigger:** I have been unresponsive on GitHub and email for 6 months.
>
> **Custodian:** [Name], a trusted colleague, has sealed credentials stored in [location].
>
> **Handover:** Code is already public on GitHub. Database backups run weekly to [location]. Domain is registered through [registrar] -- credentials are in the sealed package. If the custodian cannot continue the project, the code remains public, user data is deleted, and the domain redirects to a notice.
>
> **Mandate:** The custodian agrees to uphold the PublicWerx constitution. If they cannot, the shutdown procedure above applies.
>
> **Last reviewed:** March 2026
