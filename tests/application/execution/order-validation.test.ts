/**
 * Tests for Order Validation
 *
 * Verifies:
 * - Order validation before execution
 * - Risk limits enforcement
 * - Price sanity checks
 * - Quantity validation
 */

import { describe, it, expect, beforeEach } from "vitest";

interface Order {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  broker: string;
  timestamp: string;
}

interface ValidationError {
  code: string;
  message: string;
}

class OrderValidator {
  private readonly maxOrderSize = 10000;
  private readonly maxPriceDeviation = 0.2; // 20%
  private readonly minPrice = 100;
  private readonly maxPrice = 1000000;

  validateOrder(order: Order, currentPrice: number): ValidationError | null {
    // Validate quantity
    if (order.quantity <= 0) {
      return { code: "INVALID_QUANTITY", message: "Quantity must be greater than 0" };
    }

    if (order.quantity > this.maxOrderSize) {
      return { code: "QUANTITY_EXCEEDED", message: `Quantity exceeds maximum of ${this.maxOrderSize}` };
    }

    // Validate price
    if (order.price < this.minPrice || order.price > this.maxPrice) {
      return { code: "INVALID_PRICE", message: `Price must be between ${this.minPrice} and ${this.maxPrice}` };
    }

    // Check price deviation
    const deviation = Math.abs((order.price - currentPrice) / currentPrice);
    if (deviation > this.maxPriceDeviation) {
      return {
        code: "EXCESSIVE_PRICE_DEVIATION",
        message: `Price deviation ${(deviation * 100).toFixed(1)}% exceeds maximum of ${this.maxPriceDeviation * 100}%`
      };
    }

    return null;
  }

  validateRiskParameters(order: Order, accountBalance: number, riskPerTrade: number): ValidationError | null {
    const orderValue = order.quantity * order.price;
    const maxRisk = accountBalance * riskPerTrade;

    if (orderValue > maxRisk) {
      return {
        code: "RISK_LIMIT_EXCEEDED",
        message: `Order value ${orderValue} exceeds risk limit ${maxRisk}`
      };
    }

    return null;
  }

  validateMarketHours(timestamp: string): ValidationError | null {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const dayOfWeek = date.getDay();

    // Market hours: 9:00 - 15:30 on weekdays
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { code: "MARKET_CLOSED", message: "Market is closed on weekends" };
    }

    if (hours < 9 || (hours === 15 && minutes > 30) || hours > 15) {
      return { code: "MARKET_CLOSED", message: "Order submitted outside market hours" };
    }

    return null;
  }
}

describe("OrderValidator", () => {
  let validator: OrderValidator;

  beforeEach(() => {
    validator = new OrderValidator();
  });

  describe("validateOrder", () => {
    const baseOrder: Order = {
      id: "order-1",
      symbol: "005930",
      side: "BUY",
      quantity: 100,
      price: 70000,
      broker: "KIS",
      timestamp: new Date().toISOString()
    };

    it("should validate a valid order", () => {
      const error = validator.validateOrder(baseOrder, 70000);
      expect(error).toBeNull();
    });

    it("should reject zero quantity", () => {
      const error = validator.validateOrder({ ...baseOrder, quantity: 0 }, 70000);
      expect(error?.code).toBe("INVALID_QUANTITY");
    });

    it("should reject negative quantity", () => {
      const error = validator.validateOrder({ ...baseOrder, quantity: -10 }, 70000);
      expect(error?.code).toBe("INVALID_QUANTITY");
    });

    it("should reject excessive quantity", () => {
      const error = validator.validateOrder({ ...baseOrder, quantity: 15000 }, 70000);
      expect(error?.code).toBe("QUANTITY_EXCEEDED");
    });

    it("should reject price below minimum", () => {
      const error = validator.validateOrder({ ...baseOrder, price: 50 }, 70000);
      expect(error?.code).toBe("INVALID_PRICE");
    });

    it("should reject price above maximum", () => {
      const error = validator.validateOrder({ ...baseOrder, price: 2000000 }, 70000);
      expect(error?.code).toBe("INVALID_PRICE");
    });

    it("should reject excessive price deviation (BUY)", () => {
      const error = validator.validateOrder({ ...baseOrder, price: 90000 }, 70000); // 28.6% above current
      expect(error?.code).toBe("EXCESSIVE_PRICE_DEVIATION");
    });

    it("should reject excessive price deviation (SELL)", () => {
      const error = validator.validateOrder({ ...baseOrder, price: 50000 }, 70000); // 28.6% below current
      expect(error?.code).toBe("EXCESSIVE_PRICE_DEVIATION");
    });

    it("should accept price within deviation threshold", () => {
      const error = validator.validateOrder({ ...baseOrder, price: 77000 }, 70000); // 10% above
      expect(error).toBeNull();
    });
  });

  describe("validateRiskParameters", () => {
    const baseOrder: Order = {
      id: "order-1",
      symbol: "005930",
      side: "BUY",
      quantity: 100,
      price: 70000,
      broker: "KIS",
      timestamp: new Date().toISOString()
    };

    it("should validate order within risk limit", () => {
      const error = validator.validateRiskParameters(baseOrder, 10000000, 0.02); // 2% risk
      expect(error).toBeNull();
    });

    it("should reject order exceeding risk limit", () => {
      const error = validator.validateRiskParameters(baseOrder, 1000000, 0.01); // 1% risk = 10k max
      expect(error?.code).toBe("RISK_LIMIT_EXCEEDED");
    });

    it("should handle zero balance", () => {
      const error = validator.validateRiskParameters(baseOrder, 0, 0.02);
      expect(error?.code).toBe("RISK_LIMIT_EXCEEDED");
    });

    it("should accept large orders with large account", () => {
      const largeOrder = { ...baseOrder, quantity: 5000 };
      const error = validator.validateRiskParameters(largeOrder, 1000000000, 0.5); // 50% risk
      expect(error).toBeNull();
    });
  });

  describe("validateMarketHours", () => {
    it("should accept order during market hours", () => {
      const timestamp = new Date();
      timestamp.setHours(10, 30, 0); // 10:30 AM
      const error = validator.validateMarketHours(timestamp.toISOString());
      expect(error).toBeNull();
    });

    it("should reject order before market opens", () => {
      const timestamp = new Date();
      timestamp.setHours(8, 30, 0); // 8:30 AM
      const error = validator.validateMarketHours(timestamp.toISOString());
      expect(error?.code).toBe("MARKET_CLOSED");
    });

    it("should reject order after market closes", () => {
      const timestamp = new Date();
      timestamp.setHours(16, 0, 0); // 4:00 PM
      const error = validator.validateMarketHours(timestamp.toISOString());
      expect(error?.code).toBe("MARKET_CLOSED");
    });

    it("should reject order on Saturday", () => {
      const timestamp = new Date();
      // Set to Saturday
      const dayOfWeek = timestamp.getDay();
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
      timestamp.setDate(timestamp.getDate() + daysUntilSaturday);
      timestamp.setHours(10, 30, 0);

      const error = validator.validateMarketHours(timestamp.toISOString());
      expect(error?.code).toBe("MARKET_CLOSED");
    });

    it("should accept order at market opening", () => {
      const timestamp = new Date();
      timestamp.setHours(9, 0, 0); // 9:00 AM
      const error = validator.validateMarketHours(timestamp.toISOString());
      expect(error).toBeNull();
    });

    it("should reject order at 15:31 (after market close)", () => {
      const timestamp = new Date();
      timestamp.setHours(15, 31, 0);
      const error = validator.validateMarketHours(timestamp.toISOString());
      expect(error?.code).toBe("MARKET_CLOSED");
    });
  });
});
