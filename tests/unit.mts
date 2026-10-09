// Quick checks for the logic that is easy to get subtly wrong. Run with: npm test
import { canonicalUnit, convertQuantity, unitOptions } from '../src/utils/units';
import { mergeIntoInventory, normalizeInventory, syncItemBatches, estimateCostFromPantry } from '../src/utils/inventoryMerge';
import { parseIngredientLine } from '../src/utils/ingredientParser';
import { summarizePrices, pricePointsFor } from '../src/utils/priceHistory';
import { allergensFromName, itemAllergens, avoidedIn } from '../src/utils/allergens';
import { estimateRecipeNutrition } from '../src/utils/nutrition';
import { mergeStates } from '../src/utils/syncMerge';
import { buildIcs, foldLine } from '../server-lib/ics';
import { extractRecipeFromHtml, isoDurationToMinutes, isPrivateAddress, assertPublicUrl } from '../server-lib/recipeExtract';
import { buildDigest } from '../server-lib/notify';
import { csvCell } from '../server-lib/csv';

let failed = 0;
const eq = (actual: unknown, expected: unknown, name: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failed++;
    console.log('FAIL', name, '\n   got     ', JSON.stringify(actual), '\n   expected', JSON.stringify(expected));
  }
};

// units
eq(canonicalUnit('Ounce'), 'oz', 'Ounce -> oz');
eq(canonicalUnit('Pounds'), 'lb', 'Pounds -> lb');
eq(canonicalUnit('weird'), null, 'unknown unit');
eq(Number(convertQuantity(1, 'lb', 'oz')!.toFixed(1)), 16, 'lb -> oz');
eq(convertQuantity(1, 'cup', 'oz'), null, 'volume never converts to weight');
eq(unitOptions('mass').some(o => o.value === 'cup'), false, 'mass mode hides cup');

// merging purchases
const base = (o: any) => ({ id: 'x' + Math.random(), category: 'Produce', location: 'Fridge', purchaseDate: '2099-01-01', expirationDate: '2099-01-10', unitPrice: 1, ...o });
const inv = [base({ name: 'Chicken', quantity: 16, unit: 'oz', totalCost: 8, unitPrice: 0.5 })];
const merged = mergeIntoInventory(inv, [base({ name: ' chicken ', quantity: 1, unit: 'Pounds', totalCost: 9, purchaseDate: '2099-01-05', expirationDate: '2099-01-07' })]);
eq([merged.inventory.length, merged.inventory[0].quantity, merged.inventory[0].totalCost, merged.inventory[0].expirationDate], [1, 32, 17, '2099-01-07'], 'same name adds quantity, keeps earliest expiry');
eq(mergeIntoInventory(inv, [base({ name: 'Chicken', quantity: 1, unit: 'cup', totalCost: 1 })]).inventory.length, 2, 'incompatible units stay separate');
eq(normalizeInventory([base({ name: 'Milk', quantity: 1, unit: 'Gallon', totalCost: 4 }), base({ name: 'milk', quantity: 2, unit: 'gal', totalCost: 8 })]).inventory.length, 1, 'duplicates collapse');

// expiry moves to the next batch once the first has passed
const milk = mergeIntoInventory([base({ name: 'Milk', quantity: 1, unit: 'l', totalCost: 2 })], [base({ name: 'Milk', quantity: 0.75, unit: 'l', totalCost: 3, expirationDate: '2099-01-20' })]).inventory[0];
eq(syncItemBatches(milk, '2099-01-05').expirationDate, '2099-01-10', 'earliest batch shown');
eq(syncItemBatches(milk, '2099-01-11').expirationDate, '2099-01-20', 'next batch once the first has passed');
eq(syncItemBatches({ ...milk, quantity: 0.75 }, '2099-01-05').expirationDate, '2099-01-20', 'using stock drains the earliest batch first');
eq(milk.latestUnitPrice, 4, 'latest price per unit');
eq(estimateCostFromPantry('milk', 0.5, 'l', [milk]), 2, 'cost from pantry price');
eq(estimateCostFromPantry('Cheese', 1, 'lb', [milk]), undefined, 'no price when unknown');

// ingredient lines
eq(parseIngredientLine('1 1/2 cups all-purpose flour, sifted'), { name: 'all-purpose flour', quantity: 1.5, unit: 'cup' }, 'mixed fraction');
eq(parseIngredientLine('½ tsp salt'), { name: 'salt', quantity: 0.5, unit: 'tsp' }, 'unicode fraction');
eq(parseIngredientLine('1/2 cup sugar'), { name: 'sugar', quantity: 0.5, unit: 'cup' }, 'plain fraction');
eq(parseIngredientLine('200g butter'), { name: 'butter', quantity: 200, unit: 'g' }, 'attached unit');
eq(parseIngredientLine('2-3 cloves garlic'), { name: 'garlic', quantity: 2, unit: 'clove' }, 'range');
eq(parseIngredientLine('1 (14 oz) can chopped tomatoes'), { name: 'chopped tomatoes', quantity: 1, unit: 'can' }, 'brackets');

// price history
const hist: any[] = [
  { id: '1', date: '2026-09-01', key: 'chicken', name: 'Chicken', unit: 'lb', unitPrice: 4, store: 'Tesco' },
  { id: '2', date: '2026-10-01', key: 'chicken', name: 'Chicken', unit: 'lb', unitPrice: 5, store: 'Aldi' },
  { id: '3', date: '2026-10-05', key: 'chicken', name: 'Chicken', unit: 'oz', unitPrice: 0.4, store: 'Aldi' },
];
const ps = summarizePrices(hist, 'chicken', 'lb');
eq([ps.points.length, Number(ps.latest!.toFixed(2)), ps.cheapest!.store], [3, 6.4, 'Tesco'], 'prices compared per unit');
eq(summarizePrices(hist, 'chicken', 'l').points.length, 0, 'incompatible units excluded');
eq(pricePointsFor([{ name: 'A', quantity: 2, unit: 'lb', totalCost: 6, purchaseDate: '2026-10-01' }, { name: 'B', quantity: 1, unit: 'lb', totalCost: 0, purchaseDate: '2026-10-01' }] as any, 'Tesco').length, 1, 'free items not recorded');

// allergens and nutrition
eq(allergensFromName('Wholemeal Bread'), ['gluten'], 'bread -> gluten');
eq(avoidedIn(itemAllergens({ name: 'Cheddar', allergens: ['milk'] }), ['gluten', 'milk']), ['milk'], 'avoid list hit');
const flour: any = { name: 'Flour', nutrition: { per: '100g', kcal: 364, protein: 10 } };
const nut = estimateRecipeNutrition({ servings: 4, ingredients: [{ name: 'Flour', quantity: 200, unit: 'g' }, { name: 'Salt', quantity: 1, unit: 'tsp' }] } as any, n => (n === 'Flour' ? flour : undefined));
eq([nut!.kcalPerServing, nut!.covered, nut!.total], [182, 1, 2], 'recipe calories from stocked items');

// two people editing at once
const empty = { inventory: [], recipes: [], plannedMeals: [], cookedLogs: [], shoppingList: [], purchaseLogs: [], rewards: [], wasteLogs: [], priceHistory: [], receiptLog: [], activity: [], settings: {} };
const baseS = { ...empty, shoppingList: [{ id: 'a', name: 'Milk' }, { id: 'b', name: 'Eggs' }] };
const mine = { ...baseS, shoppingList: [...baseS.shoppingList, { id: 'c', name: 'Bread' }] };
const theirs = { ...baseS, shoppingList: [{ id: 'a', name: 'Milk' }, { id: 'b', name: 'Eggs 12' }, { id: 'd', name: 'Rice' }] };
eq(mergeStates(baseS as any, mine as any, theirs as any).shoppingList.map((i: any) => i.name).sort(), ['Bread', 'Eggs 12', 'Milk', 'Rice'], 'both people\'s changes kept');

// calendar
const ics = buildIcs([{ id: 'a1', date: '2026-10-12', slot: 'Dinner', customName: 'Mac & Cheese, "classic"; yum', servings: 2 }], new Date('2026-10-09T10:00:00Z'));
eq(ics.includes('DTSTART:20261012T180000'), true, 'ics dinner time');
eq(ics.includes('Cheese\\, "classic"\; yum'), true, 'ics escaping');
eq(ics.split('\r\n').every(l => Buffer.byteLength(l) <= 75), true, 'ics lines folded');
eq(foldLine('X'.repeat(200)).split('\r\n').every(l => l.length <= 75), true, 'fold long line');

// recipe import
eq(isoDurationToMinutes('PT1H30M'), 90, 'duration');
const html = `<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":["Recipe"],"name":"Best &amp; Easy Pancakes","recipeYield":["4","4 servings"],"prepTime":"PT10M","cookTime":"PT15M","recipeIngredient":["1 1/2 cups flour","2 eggs"],"recipeInstructions":[{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"Mix."},{"@type":"HowToStep","text":"Fry."}]}]}]}</script>`;
const r = extractRecipeFromHtml(html)!;
eq([r.name, r.servings, r.prepMinutes, r.cookMinutes, r.ingredients.length, r.instructions], ['Best & Easy Pancakes', 4, 10, 15, 2, ['Mix.', 'Fry.']], 'schema.org recipe');
eq(extractRecipeFromHtml('<html>nothing</html>'), null, 'no recipe');
for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.50', '172.20.1.1', '169.254.1.1', '::1', 'fd00::1', '::ffff:192.168.0.1']) eq(isPrivateAddress(ip), true, 'private ' + ip);
eq(isPrivateAddress('8.8.8.8'), false, 'public address');
for (const u of ['http://localhost/x', 'http://192.168.1.5/', 'file:///etc/passwd', 'http://user:pw@example.com/', 'http://[::1]/']) {
  let err = '';
  try { await assertPublicUrl(u); } catch (e: any) { err = e.message; }
  eq(err !== '', true, 'blocked ' + u);
}

// daily alert and csv
const dg = buildDigest({ today: '2026-10-09', daysAhead: 3, inventory: [{ name: 'Chicken', quantity: 2, unit: 'lb', expirationDate: '2026-10-10' }, { name: 'Rice', quantity: 1, unit: 'lb', expirationDate: '2027-01-01', parLevel: 3 }, { name: 'Gone', quantity: 0, unit: 'lb', expirationDate: '2026-10-01' }], plannedMeals: [{ date: '2026-10-09', slot: 'Dinner', customName: 'Stew' }] });
eq(dg?.lines.length, 3, 'digest lines (soon, low, today)');
eq(buildDigest({ today: '2026-10-09', daysAhead: 3, inventory: [], plannedMeals: [] }), null, 'nothing to say');
eq(csvCell('=SUM(A1)'), "'=SUM(A1)", 'csv formula guard');
eq(csvCell('a,"b"'), '"a,""b"""', 'csv quoting');

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('All checks passed');
