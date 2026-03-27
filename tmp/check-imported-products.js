const fs = require("fs");

const path = "data/sourcing/alibaba-imported-products.json";
const items = JSON.parse(fs.readFileSync(path, "utf8"));

const summary = items.reduce(
  (acc, item) => {
    acc.total += 1;
    acc.status[item.status] = (acc.status[item.status] || 0) + 1;
    acc.published[String(Boolean(item.publishedToSite))] =
      (acc.published[String(Boolean(item.publishedToSite))] || 0) + 1;
    const combo = `${item.status}|${Boolean(item.publishedToSite)}`;
    acc.combos[combo] = (acc.combos[combo] || 0) + 1;
    return acc;
  },
  { total: 0, status: {}, published: {}, combos: {} },
);

console.log(JSON.stringify(summary, null, 2));
