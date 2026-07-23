/**
 * Hand-curated companion/antagonist relationships among the Stage 1.3
 * hand-verified spacing crops (Workplan Stage 1.4 — see
 * `docs/adr/0008-companion-planting-data.md`).
 *
 * This is the part of Stage 1.4 that is genuine curation, not ingestion (the
 * same split `docs/adr/0007` drew for the spacing table): each relationship
 * below was chosen, evidence-tagged, and cited by hand, honestly weighing a
 * real mechanism/study against popular gardening folklore — the opposite of
 * blanket-tagging everything the same way (`docs/adr/0006`'s rejected
 * alternative). Every entry cites a genuine source; every `note` records
 * *why* that evidence tag, not just what the pairing is.
 *
 * ── On retrieval honesty ──
 * As with `docs/adr/0007`'s spacing citations, several of the domains cited
 * below (`rhs.org.uk`-class extension/university sites, `almanac.com`) are
 * blocked by this sandbox's egress policy for direct fetches. Every citation
 * here was retrieved via web-search result snippets of the source's own
 * published words (never fabricated), with the real page URL recorded — the
 * same reproducible-by-a-networked-reviewer discipline Stage 1.3 used.
 */

import type { SourceRef } from '@garden-planner/engine';
import type { CompanionRelationship } from './schema.ts';

/** The date every citation below was retrieved (ISO-8601). */
const RETRIEVED_AT = '2026-07-22';

/** Build a {@link SourceRef}, keeping the citations below uniform and readable. */
function cite(source: string, url: string, note?: string): SourceRef {
  return { source, url, retrievedAt: RETRIEVED_AT, note };
}

/**
 * The allium-vs-legume "alliums stunt legume growth" claim (see the
 * onion/pea, garlic/french-bean, and leek/broad-bean entries below) rests on
 * the same two sources every time — factored out so the three entries can't
 * silently drift on the citation text.
 */
const wvuAlliumLegume = (note: string): SourceRef =>
  cite(
    'West Virginia University Extension',
    'https://extension.wvu.edu/lawn-gardening-pests/gardening/garden-management/companion-planting',
    note,
  );
const mdpiAlleopathyReview = (): SourceRef =>
  cite(
    'MDPI, Horticulturae (review)',
    'https://www.mdpi.com/2311-7524/12/4/438',
    'Allelopathic Interactions in Vegetable Production Systems: notes the short spatial/temporal reach of allium organosulfur compounds',
  );

export const CURATED_COMPANION_RELATIONSHIPS: readonly CompanionRelationship[] = [
  {
    from: 'onion',
    to: 'carrot',
    kind: 'companion',
    evidence: 'well-supported',
    note:
      'A peer-reviewed field study (Uvah & Coaker 1984) found intercropping onions and ' +
      'carrots cut carrot fly damage on carrots and thrips damage on onions, versus either ' +
      "grown alone — the mechanism (each crop's volatile scent masking the other from its " +
      'pest) is genuinely entomological, not folk wisdom, and the finding is widely cited in ' +
      'agricultural-research literature since. Recorded well-supported and mutual: both crops ' +
      'benefit.',
    sources: [
      cite(
        'Uvah, I.I.I. & Coaker, T.H. (1984), Entomologia Experimentalis et Applicata',
        'https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1570-7458.1984.tb03422.x',
        'Effect of mixed cropping on some insect pests of carrots and onions',
      ),
      cite(
        'Cornell Cooperative Extension (Ulster County), summarising Kourik',
        'https://ulster.cce.cornell.edu/resources/companion-planting-and-flower-borders',
        'cites the same onion/carrot intercropping pest-reduction finding',
      ),
    ],
    symmetric: true,
  },
  {
    from: 'potato',
    to: 'tomato',
    kind: 'antagonist',
    evidence: 'well-supported',
    note:
      'Potato and tomato are both hosts of Phytophthora infestans (late blight) and share ' +
      'several pests (e.g. Colorado potato beetle); extension plant-pathology guidance ' +
      'explicitly advises against planting them near or in rotation with each other because ' +
      'inoculum on one readily spreads to the other. This is a documented disease-epidemiology ' +
      'risk, not a folk claim — recorded well-supported and mutual: the shared-susceptibility ' +
      'risk runs both ways.',
    sources: [
      cite(
        'University of Maryland Extension',
        'https://extension.umd.edu/resource/late-blight-tomato-and-potato',
        'Late Blight of Tomato and Potato',
      ),
      cite(
        'NC State Extension Publications',
        'https://content.ces.ncsu.edu/potato-late-blight',
        'potato late blight, same pathogen and host-proximity risk as tomato',
      ),
    ],
    symmetric: true,
  },
  {
    // Directional: `from` is the plant that *receives* the benefit (lettuce)
    // — a non-symmetric relationship's `to` is the companion recommended
    // *for* `from`, so the beneficiary has to be `from` for the eventual
    // `Plant.companions` link to actually surface the useful direction (see
    // schema.ts's doc comment on `symmetric`).
    from: 'lettuce',
    to: 'pea',
    kind: 'companion',
    evidence: 'well-supported',
    note:
      'Legumes fixing atmospheric nitrogen via rhizobia is well-established microbiology, and ' +
      'research on intercropped legume/non-legume systems has measured real, quantified ' +
      'within-season nitrogen transfer to a neighbouring non-legume crop (not just after the ' +
      'legume is cut down) — though the transferred share is variable and typically smaller ' +
      'than the benefit a *following* rotation crop gets from decomposing legume residue. ' +
      'Recorded well-supported for the mechanism and its measured effect, but one-directional: ' +
      'the benefit runs from the nitrogen-fixing pea to lettuce, not back — so this is recorded ' +
      'as a companion recommendation *for lettuce* (pea), not the reverse.',
    sources: [
      cite(
        'SARE (Sustainable Agriculture Research & Education)',
        'https://www.sare.org/publications/crop-rotation-on-organic-farms/guidelines-for-intercropping/intercropping-legumes-with-nonlegumes/',
        'Intercropping Legumes with Nonlegumes',
      ),
      cite(
        'Agronomy for Sustainable Development (Springer), review article',
        'https://link.springer.com/article/10.1007/s13593-016-0396-4',
        'Belowground nitrogen transfer from legumes to non-legumes under managed herbaceous cropping systems',
      ),
    ],
    symmetric: false,
  },
  {
    from: 'onion',
    to: 'pea',
    kind: 'antagonist',
    evidence: 'traditional',
    note:
      'Widely repeated gardening advice says alliums stunt legumes by suppressing the ' +
      'Rhizobium bacteria in their root nodules, and there is real chemistry behind it ' +
      '(alliums release organosulfur compounds). But a review of allelopathic interactions in ' +
      'vegetable systems notes these sulfur compounds are highly reactive and short-lived, ' +
      'limiting how far and how reliably the effect actually reaches in a real garden bed — the ' +
      'claim is mechanistically plausible but not settled at garden scale. Recorded traditional, ' +
      'not well-supported, until a controlled field trial (not just the lab chemistry) backs it.',
    sources: [
      wvuAlliumLegume(
        'alliums are known to hinder the growth of beans/peas and should not be planted with them',
      ),
      mdpiAlleopathyReview(),
    ],
    symmetric: true,
  },
  {
    from: 'garlic',
    to: 'french-bean',
    kind: 'antagonist',
    evidence: 'traditional',
    note:
      'Same allium-vs-legume folklore as onion/pea above, applied to garlic and French bean — ' +
      'popular companion-planting guidance warns against the pairing on the same rhizobium-' +
      'suppression reasoning, which is mechanistically plausible but not confirmed at garden ' +
      'scale (see the onion/pea note for the same caveat). Recorded traditional.',
    sources: [
      wvuAlliumLegume('alliums (including garlic) are known to hinder the growth of beans'),
      mdpiAlleopathyReview(),
    ],
    symmetric: true,
  },
  {
    from: 'leek',
    to: 'broad-bean',
    kind: 'antagonist',
    evidence: 'traditional',
    note:
      'Same allium-vs-legume folklore again, applied to leek and broad bean — one of the most ' +
      'repeated "bad companion" pairings in gardening guides, on the same rhizobium-suppression ' +
      'reasoning that lab chemistry supports but garden-scale trials have not confirmed. ' +
      'Recorded traditional.',
    sources: [
      wvuAlliumLegume('alliums (including leeks) are known to hinder the growth of beans/peas'),
      mdpiAlleopathyReview(),
    ],
    symmetric: true,
  },
  {
    from: 'carrot',
    to: 'radish',
    kind: 'companion',
    evidence: 'traditional',
    note:
      'A very common companion-planting-chart pairing: radishes are said to mark slow-germinating ' +
      'carrot rows, break the soil surface for carrot seedlings, and clear the ground before ' +
      'carrots need the space — a garden-management convenience claim, not a study finding. ' +
      'Recorded traditional.',
    sources: [
      cite(
        "Old Farmer's Almanac",
        'https://www.almanac.com/companion-planting-guide-vegetables',
        'radish/carrot pairing: shared bed use, radish marks and loosens the row for carrots',
      ),
    ],
    symmetric: true,
  },
  {
    from: 'lettuce',
    to: 'carrot',
    kind: 'companion',
    evidence: 'traditional',
    note:
      "A standard companion-planting-chart pairing: lettuce's shallow roots are said not to " +
      'compete with the deeper carrot root, letting the two share a bed efficiently. This is a ' +
      'garden-space-efficiency claim repeated across gardening guides, not a controlled-trial ' +
      'finding. Recorded traditional.',
    sources: [
      cite(
        "Old Farmer's Almanac",
        'https://www.almanac.com/companion-plants-for-carrots',
        'lettuce/carrot pairing: shallow lettuce roots vs deeper carrot roots, shared bed space',
      ),
    ],
    symmetric: true,
  },
];
