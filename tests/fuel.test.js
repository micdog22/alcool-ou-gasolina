import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, formatNumber, formatBRL, formatPrice, formatPercent, compareFuels, tripCost, splitCents } from '../src/fuel.js';

const base = { ethanolPrice: '3,99', gasolinePrice: '5,79', ethanolKml: '', gasolineKml: '', rule: '70', tank: '', kmPerMonth: '' };
const compare = (extra) => compareFuels({ ...base, ...extra });

test('lê números no formato brasileiro', () => {
  assert.equal(parseNumber('5,79', 3), 5790);
  assert.equal(parseNumber('5.799', 3), 5799);
  assert.equal(parseNumber('R$ 4,5', 3), 4500);
  assert.equal(parseNumber('11,5', 2), 1150);
  assert.equal(parseNumber('1.200', 0, { thousands: true }), 1200);
  assert.equal(parseNumber('1.200,5', 1, { thousands: true }), 12005);
  assert.equal(parseNumber('12.5', 1, { thousands: true }), 125);
  assert.equal(parseNumber('', 2), null);
  for (const bad of ['5,7999', '-1', '\u22123', 'abc', '1,2,3', ',']) assert.ok(Number.isNaN(parseNumber(bad, 3)), bad);
});

test('formatação', () => {
  assert.equal(formatNumber(1234.5, 2), '1.234,50');
  assert.equal(formatNumber(0.4987, 3), '0,499');
  assert.equal(formatBRL(41688), 'R$ 416,88');
  assert.equal(formatPrice(5790), 'R$ 5,79');
  assert.equal(formatPrice(5799), 'R$ 5,799');
  assert.equal(formatPercent(0.689119, 0.7), '68,9%');
  assert.equal(formatPercent(0.70004, 0.7), '70,004%'); // não mostra "70,0%" se não for empate
  assert.equal(formatPercent(0.7, 0.7), '70,0%');
});

test('regra dos 70%: etanol, gasolina e empate', () => {
  const ethanol = compare();
  assert.equal(ethanol.mode, 'rule');
  assert.equal(ethanol.verdict, 'ethanol');
  assert.equal(ethanol.ratioLabel, '68,9%');
  assert.match(ethanol.message, /abaixo do limite de 70%/);

  assert.equal(compare({ ethanolPrice: '4,10' }).verdict, 'gasoline');

  const tie = compare({ ethanolPrice: '3,50', gasolinePrice: '5,00' });
  assert.equal(tie.verdict, 'tie');
  assert.match(tie.message, /^Tanto faz/);
  // 1 milésimo de real para cada lado já decide
  assert.equal(compare({ ethanolPrice: '3,499', gasolinePrice: '5,00' }).verdict, 'ethanol');
  assert.equal(compare({ ethanolPrice: '3,501', gasolinePrice: '5,00' }).verdict, 'gasoline');
});

test('regra ajustável de 65% a 75%', () => {
  assert.equal(compare({ ethanolPrice: '4,10', rule: '75' }).verdict, 'ethanol');
  assert.equal(compare({ ethanolPrice: '3,99', rule: '65' }).verdict, 'gasoline');
  assert.equal(compare({ ethanolPrice: '3,625', gasolinePrice: '5,00', rule: '72,5' }).verdict, 'tie');
  assert.equal(compare({ rule: '72,5' }).limitLabel, '72,5%');
  assert.match(compare({ rule: '64,9' }).errors[0], /entre 65% e 75%/);
  assert.match(compare({ rule: '76' }).errors[0], /entre 65% e 75%/);
  assert.deepEqual(compare({ rule: '65' }).errors, []);
});

test('consumo real do carro substitui a regra', () => {
  const r = compare({ ethanolKml: '8', gasolineKml: '11,5' });
  assert.equal(r.mode, 'real');
  assert.equal(r.verdict, 'ethanol'); // 3,99/5,79 = 0,6891 < 8/11,5 = 0,6957
  assert.equal(r.limitLabel, '69,6%');
  assert.equal(compare({ ethanolKml: '7,5', gasolineKml: '11,5' }).verdict, 'gasoline'); // limite 0,6522
  const tie = compare({ ethanolPrice: '3,50', gasolinePrice: '5,00', ethanolKml: '7', gasolineKml: '10' });
  assert.equal(tie.verdict, 'tie');
  // a regra é ignorada quando os dois consumos foram informados
  assert.equal(compare({ ethanolKml: '8', gasolineKml: '11,5', rule: '65' }).verdict, 'ethanol');
});

test('preço máximo do etanol que ainda compensa', () => {
  assert.equal(compare().ethanolMaxCents, 405); // 70% de 5,79 = 4,053
  assert.equal(compare({ gasolinePrice: '5,00' }).ethanolMaxCents, 349); // 3,50 seria empate
  assert.equal(compare({ ethanolKml: '7', gasolineKml: '10', gasolinePrice: '6,00' }).ethanolMaxCents, 419);
});

test('custo por km de cada combustível', () => {
  const r = compare({ ethanolKml: '8', gasolineKml: '11,5' });
  assert.ok(Math.abs(r.costPerKm.ethanol - 0.49875) < 1e-9);
  assert.ok(Math.abs(r.costPerKm.gasoline - 5.79 / 11.5) < 1e-9);
  assert.equal(compare().costPerKm, null); // sem nenhum consumo não dá para saber

  const estimated = compare({ gasolineKml: '10' }); // regra: etanol faria 7 km/l
  assert.equal(estimated.mode, 'rule');
  assert.equal(estimated.estimated, 'ethanol');
  assert.ok(Math.abs(estimated.costPerKm.ethanol - 3.99 / 7) < 1e-9);
  const fromEthanol = compare({ ethanolKml: '7' });
  assert.equal(fromEthanol.estimated, 'gasoline');
  assert.ok(Math.abs(fromEthanol.costPerKm.gasoline - 5.79 / 10) < 1e-9);
});

test('economia por tanque cheio e por mês', () => {
  assert.equal(compare({ tank: '50' }).tankSavingsCents, 315); // 50 × (4,053 - 3,99)
  assert.equal(compare({ ethanolPrice: '4,29', tank: '50' }).tankSavingsCents, 1693); // 50 × (4,29/0,7 - 5,79)
  assert.equal(compare({ ethanolPrice: '3,50', gasolinePrice: '5,00', tank: '50' }).tankSavingsCents, 0);

  const month = compare({ ethanolKml: '8', gasolineKml: '11,5', kmPerMonth: '1.000' });
  assert.equal(month.monthSavingsCents, Math.round((5.79 / 11.5 - 3.99 / 8) * 1000 * 100));
  assert.equal(month.monthSavingsCents, 473);
  assert.equal(compare({ kmPerMonth: '1000' }).monthSavingsCents, null);
});

test('validação de preços e consumos', () => {
  assert.match(compare({ ethanolPrice: '' }).errors[0], /Informe o preço do etanol/);
  assert.match(compare({ gasolinePrice: '0' }).errors[0], /maior que zero/);
  assert.match(compare({ gasolinePrice: '-5,79' }).errors[0], /Não entendi o preço da gasolina/);
  assert.match(compare({ ethanolKml: '0' }).errors[0], /consumo com etanol precisa ser maior que zero/);
  assert.match(compare({ tank: '-50' }).errors[0], /capacidade do tanque/);
});

test('custo da viagem com ida e volta, pedágios e divisão', () => {
  const r = tripCost({ distance: '432', roundTrip: true, kml: '12', price: '5,79', tolls: '45,60', people: '3' });
  assert.deepEqual(r.errors, []);
  assert.equal(r.km, 864);
  assert.equal(r.liters, 72);
  assert.equal(r.fuelCents, 41688);
  assert.equal(r.totalCents, 46248);
  assert.deepEqual(r.parts, [15416, 15416, 15416]);

  const oneWay = tripCost({ distance: '432', roundTrip: false, kml: '12', price: '5,79', tolls: '', people: '' });
  assert.equal(oneWay.fuelCents, 20844);
  assert.equal(oneWay.totalCents, 20844);
  assert.deepEqual(oneWay.parts, [20844]);
});

test('viagem: arredondamento e divisão exata dos centavos', () => {
  const r = tripCost({ distance: '100', roundTrip: false, kml: '11', price: '5,79', tolls: '0', people: '5' });
  assert.equal(r.fuelCents, 5264); // 100/11 × 5,79 = 52,636…
  assert.deepEqual(r.parts, [1053, 1053, 1053, 1053, 1052]);
  assert.equal(r.parts.reduce((a, b) => a + b, 0), r.totalCents);
  assert.deepEqual(splitCents(100, 3), [34, 33, 33]);
});

test('viagem: validação de zero e negativos', () => {
  assert.match(tripCost({ distance: '0', kml: '12', price: '5' }).errors[0], /distância precisa ser maior que zero/);
  assert.match(tripCost({ distance: '100', kml: '-12', price: '5' }).errors[0], /consumo do carro/);
  assert.match(tripCost({ distance: '100', kml: '12', price: '0' }).errors[0], /preço do combustível precisa ser maior que zero/);
  assert.match(tripCost({ distance: '100', kml: '12', price: '5', people: '0' }).errors[0], /quantas pessoas/);
  assert.match(tripCost({ distance: '100', kml: '12', price: '5', tolls: '-3' }).errors[0], /pedágios/);
});
