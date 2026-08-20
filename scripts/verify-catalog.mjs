import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const catalog = JSON.parse(await readFile(new URL("../catalogo.json", import.meta.url), "utf8"));

const originalIds = [
  "feminina_hidra_azul",
  "feminina_verde_floral",
  "feminina_pantera_rosa",
  "feminina_telemovel",
  "masculina_bracelet",
  "masculina_sete_nos",
  "masculina_britanico",
  "masculina_conchas",
  "casais_sempre_juntos",
  "casais_azul_azul",
  "personalizados_identidade",
  "personalizados_historias",
];

const ids = catalog.products.map((product) => product.id);
assert.equal(new Set(ids).size, ids.length, "O catálogo não pode conter IDs de produto duplicados.");

for (const id of originalIds) {
  const product = catalog.products.find((item) => item.id === id);
  assert.ok(product, `O produto original ${id} não pode desaparecer do catálogo.`);
  assert.equal(product.source, "original", `O produto ${id} tem de permanecer identificado como original.`);
}

for (const collection of ["Feminina", "Masculina", "Casais", "Personalizados"]) {
  assert.ok(catalog.products.some((product) => product.collection === collection && product.active !== false), `A colecção ${collection} deve manter pelo menos um produto activo.`);
}

console.log(`Catálogo válido: ${catalog.products.length} produtos, ${originalIds.length} originais protegidos.`);
