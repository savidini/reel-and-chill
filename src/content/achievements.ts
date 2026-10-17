// Brief community pointers supplement the requirements imported from the game.
// Keep IDs stable so reimporting the catalog does not overwrite editorial notes.
export const achievementSource = {
  title: 'Caff Caff’s 100% Achievement Guide',
  url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3501739394',
};

export type AchievementNote = {
  tip: string;
  articleId: string;
  fishIds?: string[];
  locationIds?: string[];
};

export const achievementNotes: Record<string, AchievementNote> = {
  'first-catch': { tip: 'Start at The Fork.', articleId: 'first-cast', locationIds: ['river1-spot1'] },
  'pat-companion': { tip: 'Count the heart animations as you pet.', articleId: 'companions-and-customisation' },
  'attract-multiple': { tip: 'Try Long Bobber near Seals Rest’s capelin school.', articleId: 'matching-tackle', fishIds: ['capelin'], locationIds: ['ocean2-spot2'] },
  snooze: { tip: 'Press Z to choose another period.', articleId: 'time-of-day' },
  'catch-above-l': { tip: 'Select Camera → Always Above before casting.', articleId: 'completion-route', fishIds: ['common-carp'], locationIds: ['lake1-spot3'] },
  'catch-above-xl': { tip: 'Select Camera → Always Above before casting.', articleId: 'completion-route', fishIds: ['northern-pike'], locationIds: ['lake1-spot2'] },
  'catch-above-xxl': { tip: 'Select Camera → Always Above before casting.', articleId: 'completion-route', fishIds: ['greenland-halibut'], locationIds: ['ocean2-spot2'] },
  'catch-again': { tip: 'Release an isolated fish, then target it again.', articleId: 'completion-route' },
  'catch-with-fish': { tip: 'Try Deep Bobber with small prey near Otter Cove’s sturgeon.', articleId: 'completion-route', fishIds: ['white-sturgeon'], locationIds: ['lake2-spot2'] },
  'lose-fish-long': { tip: 'Break the line after two minutes; releasing won’t count.', articleId: 'fighting-fish' },
  'drill-hole': { tip: 'Dismount your snowmobile and cast.', articleId: 'ice-fishing', locationIds: ['ice1-spot1'] },
  'catch-hole': { tip: 'Keep using one hole; releases count too.', articleId: 'ice-fishing', locationIds: ['ice1-spot1'] },
  'discover-all-fish': { tip: 'Check your logbook for missing species.', articleId: 'completion-route' },
  'catch-release-all': { tip: 'Choose the red X to release your catch.', articleId: 'completion-route' },
  'catch-trophy-all': { tip: 'Target trophy thresholds, rather than every size.', articleId: 'trophies-and-legends' },
  'buy-upgrade-all': { tip: 'Include every rod and boat upgrade.', articleId: 'rusty-and-unlocks' },
  'catch-size-species-all': { tip: 'Fill every size slot in your logbook.', articleId: 'completion-route' },
  'clean-pond': { tip: 'Include the 750-coin waterfall obstruction.', articleId: 'pond-cleanup', locationIds: ['cabin1'] },
  'restore-cabin': { tip: 'Repairs total 19,000 coins, excluding the deed.', articleId: 'cabin-restoration', locationIds: ['cabin1'] },
  'viewer-watched': { tip: 'Restore the viewer and clean the pond first.', articleId: 'viewer-and-trophy-wall', locationIds: ['cabin1'] },
  'max-stocked': { tip: 'Stock eight species with eight fish each.', articleId: 'pond-stocking', locationIds: ['cabin1'] },
  'catch-stocked': { tip: 'Fish in your stocked pond.', articleId: 'pond-stocking', locationIds: ['cabin1'] },
};

export const whiteTipNote = 'The community guide suggests noon; the installed game allows any time. Rusty’s quests still apply.';
