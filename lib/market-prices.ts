export const MARKET_PRICES_AR = {
  currency: "ARS",
  last_updated: "2025-11-23",
  context_note: "Precios estimados en Supermercados/Verdulerías de Argentina (CABA/GBA). Inflación alta, precios volátiles.",
  staples: {
    proteins: {
      "Pollo entero (kg)": "3500 - 4500",
      "Milanesa de carne (kg)": "7000 - 9000",
      "Carne picada común (kg)": "5000 - 6500",
      "Huevos (maple 30u)": "4500 - 5500",
      "Lata de atún (170g)": "2500 - 3500",
      "Queso cremoso (kg)": "7000 - 9000"
    },
    carbs: {
      "Arroz (kg)": "1800 - 2800",
      "Fideos guiseros (500g)": "1200 - 2000",
      "Polenta (500g)": "1000 - 1500",
      "Pan francés (kg)": "2200 - 3000",
      "Lentejas (400g)": "2000 - 2800"
    },
    vegetables: {
      "Papa (kg)": "800 - 1200",
      "Cebolla (kg)": "800 - 1200",
      "Zanahoria (kg)": "900 - 1300",
      "Tomate (kg)": "2500 - 4000",
      "Lechuga (kg)": "3000 - 5000",
      "Banana (kg)": "1800 - 2800",
      "Manzana (kg)": "2000 - 3000"
    },
    dairy_misc: {
      "Leche (litro)": "1300 - 1800",
      "Yogur bebible (litro)": "2000 - 3000",
      "Aceite Girasol (900ml)": "1800 - 2600",
      "Yerba (500g)": "2500 - 3500"
    }
  }
};

export function getMarketContext(locale: string = 'es') {
  // Simple logic: if locale is Spanish, assume Argentina context for this MVP.
  // In a real app, we would check country code (es-AR, es-MX, etc).
  if (locale.startsWith('es')) {
    return `
      MARKET MEMORY (PRECIOS REFERENCIA ARGENTINA - NOV 2025):
      Moneda: Pesos Argentinos (ARS).
      
      VALOR DEL DINERO (Contexto Crítico):
      - $500 ARS es MUY POCO dinero (aprox $0.45 USD). NO alcanza para 1kg de comida.
      - $1000 ARS compra: 1kg de papas O 1 paquete de fideos económico.
      - $5000 ARS es un billete común. Compra: 1kg de carne picada O 1 maple de huevos.
      - $10.000 ARS es una compra mínima de supermercado (pocos items).

      LISTA DE PRECIOS VIGENTE (Usa estos valores para tus cálculos):
      ${JSON.stringify(MARKET_PRICES_AR.staples, null, 2)}
      
      SI EL USUARIO PREGUNTA "QUE COMPRO CON X PLATA":
      1. Verifica contra esta lista qué alcanza realmente.
      2. Si el monto es muy bajo (ej. $500), sé honesto: "Con $500 hoy solo te alcanza para una fruta o un poco de pan".
      3. NO inventes precios fuera de este rango.
    `;
  }
  
  return "Market context not available for this region.";
}
