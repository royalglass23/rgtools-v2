# Lead Intake Form

The lead intake form is at `/lead-intake`. Use it to record every new enquiry you receive — phone calls, emails, WeChat messages, or any other channel.

## Opening the form

Click **Lead Intake** in the top navigation bar. If you don't see it, ask an admin to grant you access.

## The Score Panel

At the top of the page, above the form, is the **Score Panel**. It updates live as you fill in the dropdowns — you'll see the tier (A/B/C/D) and total score change in real time. You don't need to submit the form to see the score.

## Filling in the form

### Client details

| Field | Notes |
|-------|-------|
| **Client Name / Business Name** | Full name or trading name. Required. |
| **Phone** | Used to detect if this client already exists. Normalised automatically. |
| **Email** | Also used for client matching. |

If a client with the same phone number or email already exists, their record will be updated rather than a new one created. The result banner will tell you if an existing client was matched.

### Job Address

Start typing the address — Google Places autocomplete will suggest matches (New Zealand addresses only). Select a suggestion to confirm.

Once an address is selected, the **Driving Distance** field below it auto-computes the distance from Royal Glass's location and shows the distance band and its scoring impact:

| Band | Distance | Points |
|------|----------|--------|
| Within 30 km | ≤ 30 km | +6 pts |
| 30 – 80 km | 31–80 km | +4 pts |
| Over 80 km | > 80 km | +2 pts |

If you clear the address, the distance resets.

### Scored dropdowns

These seven dropdowns feed into the scoring engine. Each choice adds a different number of points. See the [Scoring Guide](scoring-guide.md) for full point values.

| Field | What to assess |
|-------|---------------|
| **Client type** | What best describes this client? Builder with repeat orders, homeowner, landlord, etc. |
| **Budget band** | Estimated total project value |
| **Consent status** | How far along is their building consent / project stage? |
| **Complexity** | Is the glass work standard, or does it involve custom/laminated/switchable glass? |
| **Price-sensitivity read** | How price-sensitive did they seem on the call? |
| **Decision-makers** | Who needs to sign off? One person, a couple, or a corporate board? |

Driving Distance is the seventh scored field and is auto-computed — you don't select it manually.

### Project type

Select the type of glass work: Pool fence, Balustrade, Shower, Handrail, or Other.

### Source

Where did the enquiry come from? Phone, Email, WeChat, Calculator, Contact form, or Other.

### Anything else

Free text for any extra notes — site access details, special requests, things to follow up on.

## Saving a lead

Click **Save and score** when ready. The button shows "Saving…" while the form submits. The form will:

1. Validate the required fields
2. Create or update the client record
3. Save the lead with all scored answers
4. Run the scoring engine
5. Attempt to sync the lead to ServiceM8

### Result banner

After saving, a green banner shows:

- **Tier** and **score** (e.g. "Tier A · 78 points")
- A plain-English reason summarising the scored answers
- An amber **blocker flag** if any strike options were selected (see [Scoring Guide](scoring-guide.md#blocker-flags))
- Whether this matched an existing client or created a new one
- ServiceM8 sync status ("sent to inbox" or "queued for retry")

If there's a validation error, a red banner appears instead with a description of what's missing.

## Editing an existing lead

To re-open and update an existing lead, navigate to the lead's edit URL (provided by an admin or linked from the lead list). The form pre-fills all previous answers. Make your changes and click **Save and score** again — the lead and score are updated in place.
