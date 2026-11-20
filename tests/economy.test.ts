import { describe, expect, it } from "vitest";
import { formatCredits, formatCreditUsd, millicreditsForMicroUsd, quoteStill, quoteVideo } from "@/shared/economy";

describe("credit rounding", () => {
  it("rounds a $0.03 still up to 0.8 credits", () => {
    expect(millicreditsForMicroUsd(30_000)).toBe(800);
    expect(quoteStill().millicredits).toBe(800);
    expect(formatCredits(800)).toBe("0.8");
    expect(formatCreditUsd(800)).toBe("$0.04");
  });

  it("prices a 5 second 480p draft at 12.9 credits", () => {
    const quote = quoteVideo("480p", 5);
    expect(quote.providerMicroUsd).toBe(514_000);
    expect(quote.millicredits).toBe(12_900);
    expect(formatCreditUsd(quote.millicredits)).toBe("$0.645");
  });

  it("prices a 5 second 720p finish at 33.8 credits", () => {
    const quote = quoteVideo("720p", 5);
    expect(quote.providerMicroUsd).toBe(1_350_000);
    expect(quote.millicredits).toBe(33_800);
    expect(formatCreditUsd(quote.millicredits)).toBe("$1.69");
  });

  it("captures nothing when the provider bills nothing", () => {
    expect(millicreditsForMicroUsd(0)).toBe(0);
  });

  it("clamps video billing to 10 seconds", () => {
    expect(quoteVideo("480p", 60).seconds).toBe(10);
  });
});
