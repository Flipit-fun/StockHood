import { SwapOrder, OrderStatus } from "./constants";

/**
 * In-memory order store.
 * In production, replace with a database (PostgreSQL, Redis, etc.)
 */
const orders: Map<string, SwapOrder> = new Map();

export function createOrder(order: SwapOrder): SwapOrder {
  orders.set(order.id, order);
  return order;
}

export function getOrder(id: string): SwapOrder | undefined {
  return orders.get(id);
}

export function updateOrderStatus(
  id: string,
  status: OrderStatus,
  extra?: Partial<SwapOrder>
): SwapOrder | undefined {
  const order = orders.get(id);
  if (!order) return undefined;

  const updated: SwapOrder = {
    ...order,
    status,
    updatedAt: Date.now(),
    ...extra,
  };
  orders.set(id, updated);
  return updated;
}

export function getOrdersByUser(solAddress: string): SwapOrder[] {
  return Array.from(orders.values()).filter(
    (o) => o.userSolAddress === solAddress
  );
}
