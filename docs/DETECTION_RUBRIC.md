# AI Jury Detection Rubric

When the `report_leak` function is called, the AI Jury fetches the suspect content and evaluates it against five dimensions to determine if a violation occurred.

## 1. Content Match (40% weight)
**Does the suspect content actually disclose the substance of the protected keywords?**
- **Violation:** Verbatim quotes or obvious paraphrasing preserving the exact meaning.
- **No Violation:** Coincidental mention of similar generic words or vague allusions.

## 2. Specificity (20% weight)
**Is the disclosed info specific enough to constitute a real violation?**
- **Violation:** Specific numbers, dates, formulas, or names explicitly connected to the protected context.
- **No Violation:** Vague statements ("Acme is raising money" vs. "Acme raising $45M from Sequoia").

## 3. Prior Public Disclosure (15% weight)
**Was the information publicly known prior to the NDA creation?**
- The AI cross-references its knowledge base for prior disclosures.
- **No Violation:** Information was already public.

## 4. Attribution / Authorship (15% weight)
**Who posted the content?**
- Can the source handle/username be traced back to `party_a` or `party_b`?
- **Unknown/Inconclusive:** Anonymous accounts without clear stylometric links.

## 5. Intent (10% weight)
**Was the leak intentional or accidental?**
- While it may not prevent a slashing in V1, intent provides critical context for future reputation systems or appeal cases.
