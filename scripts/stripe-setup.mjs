import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Set STRIPE_SECRET_KEY before npm run stripe:setup");
  process.exit(1);
}

const stripe = new Stripe(key);
const catalog = [
  { env: "STRIPE_PRICE_STARTER", name: "NR8R Starter", cents: 1500, recurring: true, tierId: "starter" },
  { env: "STRIPE_PRICE_MAKER", name: "NR8R Maker", cents: 2900, recurring: true, tierId: "maker" },
  { env: "STRIPE_PRICE_STUDIO", name: "NR8R Studio", cents: 5900, recurring: true, tierId: "studio" },
  { env: "STRIPE_PRICE_PACK_200", name: "NR8R 200 credits", cents: 1000, recurring: false, tierId: "pack_200" },
  { env: "STRIPE_PRICE_PACK_500", name: "NR8R 500 credits", cents: 2500, recurring: false, tierId: "pack_500" },
  { env: "STRIPE_PRICE_PACK_1000", name: "NR8R 1000 credits", cents: 5000, recurring: false, tierId: "pack_1000" },
];

for (const item of catalog) {
  const product = await stripe.products.create({
    name: item.name,
    metadata: { tierId: item.tierId, purchaseKind: item.recurring ? "plan" : "pack" },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: item.cents,
    ...(item.recurring ? { recurring: { interval: "month" } } : {}),
    metadata: { tierId: item.tierId },
  });
  console.log(`${item.env}=${price.id}`);
}

console.log("Optional. Checkout already works with inline price_data when these are unset.");
