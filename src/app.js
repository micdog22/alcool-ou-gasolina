import { compareFuels, tripCost, formatBRL, formatNumber, formatPrice } from './fuel.js';

const STORAGE_KEY = 'alcool-ou-gasolina:v1';
const DEFAULTS = { rule: '70', tank: '50', tripPeople: '1', tripRoundTrip: false };
const $ = (id) => document.getElementById(id);
const fields = [...document.querySelectorAll('[data-key]')];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') return { ...DEFAULTS, ...saved };
  } catch {
    // armazenamento indisponível: usa os valores padrão
  }
  return { ...DEFAULTS };
}

function save(values) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // sem armazenamento: segue sem lembrar os valores
  }
}

function readValues() {
  const values = {};
  for (const field of fields) values[field.dataset.key] = field.type === 'checkbox' ? field.checked : field.value;
  return values;
}

function ruleLabel(value) {
  return `${String(value).replace('.', ',')}%`;
}

function numbers(rows) {
  const list = el('dl', { class: 'numeros' });
  for (const [term, value, note] of rows) {
    list.append(el('dt', { text: term }), el('dd', {}, value, note ? el('span', { class: 'sub', text: note }) : null));
  }
  return list;
}

function per100Km(value) {
  return `${formatBRL(Math.round(value * 10000))} a cada 100 km`;
}

function perKmNote(value, estimated) {
  return `R$ ${formatNumber(value, 3)} por km${estimated ? ' · consumo estimado pela regra' : ''}`;
}

function renderComparison(values) {
  const box = $('resultado');
  if (!values.ethanolPrice.trim() || !values.gasolinePrice.trim()) {
    box.replaceChildren(el('p', { class: 'muted', text: 'Digite os preços do etanol e da gasolina para ver qual compensa.' }));
    return;
  }
  const r = compareFuels(values);
  if (r.errors.length) {
    box.replaceChildren(el('ul', { class: 'erros' }, ...r.errors.map((e) => el('li', { text: e }))));
    return;
  }

  const titles = { ethanol: 'Abasteça com etanol', gasoline: 'Abasteça com gasolina', tie: 'Tanto faz' };
  const nodes = [el('p', { class: `veredito ${r.verdict}`, text: titles[r.verdict] }), el('p', { class: 'mensagem', text: r.message })];
  if (r.ethanolMaxCents > 0) {
    const where = r.mode === 'real' ? 'no seu carro' : `pela regra de ${r.limitLabel}`;
    nodes.push(el('p', { text: `Com a gasolina a ${formatPrice(r.gasolinePrice)}, o etanol compensa ${where} até ${formatBRL(r.ethanolMaxCents)} o litro.` }));
  }

  const rows = [];
  if (r.costPerKm) {
    rows.push(['Custo com etanol', per100Km(r.costPerKm.ethanol), perKmNote(r.costPerKm.ethanol, r.estimated === 'ethanol')]);
    rows.push(['Custo com gasolina', per100Km(r.costPerKm.gasoline), perKmNote(r.costPerKm.gasoline, r.estimated === 'gasoline')]);
  }
  if (r.tankSavingsCents !== null) {
    const fuelName = r.verdict === 'ethanol' ? 'etanol' : 'gasolina';
    const other = r.verdict === 'ethanol' ? 'gasolina' : 'etanol';
    rows.push([`Economia por tanque cheio (${formatNumber(r.tankLiters, r.tankLiters % 1 ? 1 : 0)} litros)`, formatBRL(r.tankSavingsCents),
      r.verdict === 'tie' ? 'dá na mesma' : `com ${fuelName}, comparado a rodar a mesma distância com ${other}`]);
  }
  if (r.monthSavingsCents !== null) {
    rows.push([`Economia no mês (${formatNumber(r.kmPerMonth, 0)} km)`, formatBRL(r.monthSavingsCents),
      r.verdict === 'tie' ? 'dá na mesma' : `abastecendo com ${r.verdict === 'ethanol' ? 'etanol' : 'gasolina'}`]);
  }
  if (rows.length) nodes.push(numbers(rows));
  if (!r.costPerKm) nodes.push(el('p', { class: 'hint', text: 'Informe o consumo com pelo menos um dos combustíveis para ver o custo por km e a economia no mês.' }));
  else if (r.monthSavingsCents === null) nodes.push(el('p', { class: 'hint', text: 'Informe quantos km você roda por mês para ver a economia no mês.' }));

  nodes.push(el('p', { class: 'hint', text: r.mode === 'real'
    ? 'Conta feita com o consumo do seu carro: o etanol compensa enquanto o preço dele for menor que essa proporção do preço da gasolina.'
    : `Conta feita pela regra de ${r.limitLabel}, que é uma aproximação. Informe o consumo do seu carro com cada combustível para uma resposta sob medida.` }));
  box.replaceChildren(...nodes);
}

function renderTrip(values) {
  const box = $('resultado-viagem');
  if (!values.tripDistance.trim() && !values.tripKml.trim() && !values.tripPrice.trim()) {
    box.replaceChildren(el('p', { class: 'muted', text: 'Preencha a distância, o consumo e o preço do combustível para ver o custo da viagem.' }));
    return;
  }
  const r = tripCost({
    distance: values.tripDistance, roundTrip: values.tripRoundTrip, kml: values.tripKml,
    price: values.tripPrice, tolls: values.tripTolls, people: values.tripPeople,
  });
  if (r.errors.length) {
    box.replaceChildren(el('ul', { class: 'erros' }, ...r.errors.map((e) => el('li', { text: e }))));
    return;
  }
  const max = r.parts[0];
  const min = r.parts[r.parts.length - 1];
  let perPerson = formatBRL(max);
  if (max !== min) {
    const nMax = r.parts.filter((p) => p === max).length;
    const nMin = r.parts.length - nMax;
    perPerson = `${formatBRL(max)} para ${nMax} ${nMax === 1 ? 'pessoa' : 'pessoas'} e ${formatBRL(min)} para ${nMin}`;
  }
  const rows = [
    ['Distância total', `${formatNumber(r.km, r.km % 1 ? 1 : 0)} km`],
    ['Combustível', `${formatNumber(r.liters, 1)} litros`],
    ['Gasto com combustível', formatBRL(r.fuelCents)],
    ['Pedágios', formatBRL(r.tollsCents)],
    ['Total da viagem', formatBRL(r.totalCents)],
  ];
  if (r.people > 1) rows.push([`Por pessoa (${r.people})`, perPerson]);
  const list = numbers(rows);
  list.classList.add('viagem');
  box.replaceChildren(list);
}

function update() {
  const values = readValues();
  $('regra-valor').textContent = ruleLabel(values.rule);
  save(values);
  renderComparison(values);
  renderTrip(values);
}

const initial = load();
for (const field of fields) {
  const value = initial[field.dataset.key];
  if (field.type === 'checkbox') field.checked = Boolean(value);
  else if (typeof value === 'string') field.value = value;
  field.addEventListener(field.type === 'checkbox' ? 'change' : 'input', update);
}

for (const button of document.querySelectorAll('[data-copiar]')) {
  button.addEventListener('click', () => {
    const source = fields.find((f) => f.dataset.key === button.dataset.copiar);
    $('preco-viagem').value = source.value;
    update();
  });
}

update();
