# Álcool ou Gasolina? Descubra qual compensa abastecer e quanto custa a viagem (HTML + JS)

Calculadora para quem tem carro flex: compare o preço do etanol e da gasolina pela regra dos 70% ou, melhor ainda, pelo consumo real do seu carro. Veja também o custo por km de cada combustível, quanto você economiza por tanque e por mês, e quanto vai gastar numa viagem, já dividido entre os passageiros.

**Acesse online:** https://micdog22.github.io/alcool-ou-gasolina/

## Recursos
- Veredito na hora: **etanol**, **gasolina** ou **tanto faz**, com a porcentagem do preço do etanol em relação ao da gasolina.
- Regra dos 70% ajustável de 65% a 75%, ou o consumo real do carro (km/l com cada combustível), que substitui a regra.
- Preço máximo do etanol que ainda compensa com o preço atual da gasolina.
- Custo a cada 100 km e por km de cada combustível (com um só consumo informado, o outro é estimado pela regra).
- Economia por tanque cheio e por mês, a partir da capacidade do tanque e de quantos km você roda.
- Custo da viagem: distância, ida e volta, consumo, preço do combustível, pedágios e divisão por pessoa, com os centavos fechando exatamente.
- Lembra os últimos valores digitados (localStorage).

## Como usar
1. Digite o preço do litro do etanol e da gasolina (aceita `3,99`, `3.99` ou `3,999`).
2. Se souber, informe o consumo do seu carro com cada combustível. Sem os dois, vale a regra escolhida no controle deslizante.
3. Preencha a capacidade do tanque e os km por mês para ver a economia.
4. Na parte da viagem, informe distância, consumo na estrada, preço do combustível, pedágios e quantas pessoas vão dividir.

Exemplo: etanol a R$ 3,99 e gasolina a R$ 5,79 dá 68,9%, abaixo de 70%: compensa abastecer com etanol, que valeria a pena até R$ 4,05 o litro.

## Como rodar localmente
Módulos ES não carregam via `file://`, então sirva a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000
```

e abra http://localhost:8000.

## Testes
```bash
npm test
```
(usa só o `node:test`, sem dependências; precisa do Node 18 ou mais novo)

## Como funciona
- **Com o consumo real:** o etanol compensa quando `preço do etanol ÷ preço da gasolina < km/l com etanol ÷ km/l com gasolina`. Se os dois lados forem iguais, dá na mesma.
- **Sem o consumo:** usa a regra prática (70% por padrão). O etanol tem menos energia por litro, e em média o carro flex roda com ele cerca de 70% do que roda com gasolina. Cada motor é diferente, por isso a regra é ajustável e medir o próprio carro é sempre melhor.
- **Economia por tanque:** compara o custo de um tanque cheio do combustível vencedor com o custo de rodar a mesma distância com o outro.
- As comparações são feitas com números inteiros (preço em milésimos de real, consumo em centésimos de km/l), então um empate exato aparece como empate, sem erro de arredondamento.

Para medir o consumo do seu carro: encha o tanque até o primeiro desarme da bomba, zere o hodômetro parcial, rode normalmente e, no próximo abastecimento até o primeiro desarme, divida os km rodados pelos litros que entraram.

Os resultados são estimativas para ajudar na decisão: preços e consumo variam.

## Contribuindo
Issues e pull requests são bem-vindos.

## Licença
MIT. Veja [LICENSE](LICENSE).
