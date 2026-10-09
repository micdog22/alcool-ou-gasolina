// Comparação etanol × gasolina e custo de viagem. Módulo puro, sem DOM.
// Os números digitados viram inteiros escalados (preço em milésimos de real, consumo em
// centésimos de km/l, regra em décimos de ponto percentual), para comparar sem erro de arredondamento.

/**
 * Lê um número no formato brasileiro e devolve o valor multiplicado por 10^decimals.
 * Vírgula é decimal; ponto é decimal, ou separador de milhar quando `thousands` está ligado
 * e o texto tem o formato 1.234. Vazio → null; inválido, negativo ou com casas demais → NaN.
 */
export function parseNumber(text, decimals, { thousands = false } = {}) {
  const s = String(text ?? '').replace(/R\$/gi, '').replace(/\s/g, '');
  if (s === '') return null;
  let integer;
  let fraction = '';
  if (s.includes(',')) {
    const m = /^(\d{1,3}(?:\.\d{3})+|\d*),(\d*)$/.exec(s);
    if (!m) return NaN;
    integer = m[1].replace(/\./g, '');
    fraction = m[2];
  } else if (thousands && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    integer = s.replace(/\./g, '');
  } else {
    const m = /^(\d*)(?:\.(\d+))?$/.exec(s);
    if (!m) return NaN;
    integer = m[1];
    fraction = m[2] ?? '';
  }
  if ((integer === '' && fraction === '') || fraction.length > decimals) return NaN;
  return Number(integer || '0') * 10 ** decimals + Number(fraction.padEnd(decimals, '0') || '0');
}

export function formatNumber(value, decimals) {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${value < 0 ? '−' : ''}${grouped}${frac ? `,${frac}` : ''}`;
}

export function formatBRL(cents) {
  return `R$ ${formatNumber(cents / 100, 2)}`;
}

/** Preço por litro em milésimos de real: mostra a 3ª casa só quando ela existe (R$ 5,79 ou R$ 5,799). */
export function formatPrice(milli) {
  return `R$ ${formatNumber(milli / 1000, milli % 10 ? 3 : 2)}`;
}

/** Porcentagem com 1 casa; usa mais casas se o arredondamento esconder a diferença para o limite. */
export function formatPercent(ratio, limit) {
  for (let d = 1; d <= 3; d++) {
    const a = formatNumber(ratio * 100, d);
    if (limit === undefined || ratio === limit || a !== formatNumber(limit * 100, d)) return `${a}%`;
  }
  return `${formatNumber(ratio * 100, 3)}%`;
}

function trimPercent(tenths) {
  return `${formatNumber(tenths / 10, tenths % 10 ? 1 : 0)}%`;
}

// ---------- Validação ----------

function positive(errors, text, decimals, label, { required = true, thousands = false, allowZero = false } = {}) {
  const value = parseNumber(text, decimals, { thousands });
  if (value === null) {
    if (required) errors.push(`Informe ${label}.`);
    return null;
  }
  if (Number.isNaN(value)) {
    errors.push(`Não entendi ${label}: use só números, com até ${decimals} ${decimals === 1 ? 'casa decimal' : 'casas decimais'} (sem sinal de menos).`);
    return null;
  }
  if (value === 0 && !allowZero) {
    errors.push(`${label[0].toUpperCase()}${label.slice(1)} precisa ser maior que zero.`);
    return null;
  }
  return value;
}

// ---------- Etanol × gasolina ----------

function ceilDiv(num, den) {
  return Math.floor((num + den - 1) / den);
}

function roundDiv(num, den) {
  return Math.floor((2 * num + den) / (2 * den));
}

export const RULE_MIN = 650; // 65,0%
export const RULE_MAX = 750; // 75,0%

/**
 * input (textos como digitados): { ethanolPrice, gasolinePrice, ethanolKml, gasolineKml, rule, tank, kmPerMonth }.
 * Com os dois consumos, o etanol compensa quando preço_e / preço_g < consumo_e / consumo_g.
 * Sem eles, usa a regra (70% por padrão, ajustável de 65% a 75%).
 */
export function compareFuels(input) {
  const errors = [];
  const pe = positive(errors, input.ethanolPrice, 3, 'o preço do etanol');
  const pg = positive(errors, input.gasolinePrice, 3, 'o preço da gasolina');
  const ce = positive(errors, input.ethanolKml, 2, 'o consumo com etanol', { required: false });
  const cg = positive(errors, input.gasolineKml, 2, 'o consumo com gasolina', { required: false });
  const tank = positive(errors, input.tank, 1, 'a capacidade do tanque', { required: false });
  const km = positive(errors, input.kmPerMonth, 0, 'a quilometragem por mês', { required: false, thousands: true, allowZero: true });
  let rule = parseNumber(input.rule ?? '70', 1);
  if (rule === null) rule = 700;
  if (Number.isNaN(rule) || rule < RULE_MIN || rule > RULE_MAX) {
    errors.push('A regra precisa ficar entre 65% e 75%.');
  }
  if (errors.length) return { errors };

  const real = ce !== null && cg !== null;
  // Limite como fração: razão entre os rendimentos (real) ou a regra escolhida (décimos de %/1000).
  const limitNum = real ? ce : rule;
  const limitDen = real ? cg : 1000;
  const limit = limitNum / limitDen;
  // Comparação exata em inteiros: pe/pg < limitNum/limitDen ⇔ pe × limitDen < pg × limitNum.
  const left = pe * limitDen;
  const right = pg * limitNum;
  const verdict = left < right ? 'ethanol' : left > right ? 'gasoline' : 'tie';

  // Maior preço do etanol (em centavos) que ainda compensa: estritamente abaixo de pg × limite.
  const ethanolMaxCents = ceilDiv(pg * limitNum, limitDen * 10) - 1;

  let kmlE = ce;
  let kmlG = cg;
  let estimated = null;
  if (!real && cg !== null) { kmlE = cg * limit; estimated = 'ethanol'; }
  if (!real && ce !== null) { kmlG = ce / limit; estimated = 'gasoline'; }
  const costPerKm = kmlE !== null && kmlG !== null
    ? { ethanol: (pe / 1000) / (kmlE / 100), gasoline: (pg / 1000) / (kmlG / 100) }
    : null;

  // Economia com um tanque cheio do combustível vencedor, comparando com rodar a mesma distância com o outro.
  let tankSavingsCents = null;
  if (tank !== null) {
    if (verdict === 'ethanol') tankSavingsCents = roundDiv((right - left) * tank, limitDen * 100);
    else if (verdict === 'gasoline') tankSavingsCents = roundDiv((left - right) * tank, limitNum * 100);
    else tankSavingsCents = 0;
  }
  const monthSavingsCents = costPerKm && km !== null ? Math.round(Math.abs(costPerKm.ethanol - costPerKm.gasoline) * km * 100) : null;

  const ratio = pe / pg;
  const ratioLabel = formatPercent(ratio, limit);
  const limitLabel = real ? formatPercent(limit) : trimPercent(rule);
  let message;
  if (verdict === 'tie') message = `Tanto faz: o etanol custa exatamente ${ratioLabel} do preço da gasolina, igual ao limite.`;
  else if (verdict === 'ethanol') message = `O etanol custa ${ratioLabel} do preço da gasolina, abaixo do limite de ${limitLabel}.`;
  else message = `O etanol custa ${ratioLabel} do preço da gasolina, acima do limite de ${limitLabel}.`;

  return {
    errors: [],
    ethanolPrice: pe,
    gasolinePrice: pg,
    mode: real ? 'real' : 'rule',
    verdict,
    ratio,
    ratioLabel,
    limit,
    limitLabel,
    message,
    ethanolMaxCents,
    costPerKm,
    estimated,
    tankLiters: tank === null ? null : tank / 10,
    tankSavingsCents,
    kmPerMonth: km,
    monthSavingsCents,
  };
}

// ---------- Viagem ----------

/** Divide centavos em n partes que somam exatamente o total (as primeiras recebem o centavo extra). */
export function splitCents(total, n) {
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** input: { distance, roundTrip, kml, price, tolls, people } (textos como digitados). */
export function tripCost(input) {
  const errors = [];
  const distance = positive(errors, input.distance, 1, 'a distância', { thousands: true });
  const kml = positive(errors, input.kml, 2, 'o consumo do carro');
  const price = positive(errors, input.price, 3, 'o preço do combustível');
  let tolls = parseNumber(input.tolls, 2, { thousands: true });
  if (tolls === null) tolls = 0;
  if (Number.isNaN(tolls)) errors.push('Não entendi o valor dos pedágios: use, por exemplo, 45,60.');
  const people = Number(String(input.people ?? '1').trim() || '1');
  if (!Number.isInteger(people) || people < 1 || people > 100) errors.push('Informe quantas pessoas vão dividir (de 1 a 100).');
  if (errors.length) return { errors };

  const tenthsKm = distance * (input.roundTrip ? 2 : 1);
  // custo em centavos = km × preço / consumo = (décimos de km) × (milésimos de R$) / (centésimos de km/l)
  const fuelCents = Math.floor((2 * tenthsKm * price + kml) / (2 * kml));
  const totalCents = fuelCents + tolls;
  const parts = splitCents(totalCents, people);
  return {
    errors: [],
    km: tenthsKm / 10,
    liters: (tenthsKm * 10) / kml,
    fuelCents,
    tollsCents: tolls,
    totalCents,
    people,
    parts,
  };
}
