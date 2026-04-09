function createProductsService(client) {
  return {
    async getProducts(params = {}) {
      const payload = await client.request("partner/products", {
        method: "GET",
        query: params,
      });

      if (Array.isArray(payload)) {
        return payload;
      }

      return payload.items ?? payload;
    },
  };
}

module.exports = {
  createProductsService,
};