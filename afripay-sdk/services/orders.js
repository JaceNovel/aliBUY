function createOrdersService(client) {
  return {
    async createOrder(data) {
      const payload = await client.request("partner/orders", {
        method: "POST",
        body: data,
      });

      return {
        order_id: payload.order_id ?? payload.order?.order_id,
        payment_url: payload.payment_url,
        payment_id: payload.payment_id,
        order: payload.order,
      };
    },
  };
}

module.exports = {
  createOrdersService,
};