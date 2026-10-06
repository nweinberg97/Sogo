// Payment provider abstraction.
//
// The product only ever talks to `PaymentProvider`. In this prototype the implementation is
// `SimulatedPaymentProvider`: no card is charged and no money moves. A production build swaps
// in a Stripe-backed provider (PaymentIntents for commitments, Connect/escrow for prize pools,
// a gift-card API for reward fulfilment) without touching any screen.
//
// TODO(production): implement StripePaymentProvider behind a server API. See README → Production roadmap.

export interface CommitRequest {
  userId: string;
  amount: number;
  purpose: 'goal_commitment' | 'challenge_commitment' | 'backing';
  referenceId: string;
  description: string;
}

export type PaymentResult =
  | { ok: true; transactionId: string; amount: number; simulated: true }
  | { ok: false; code: 'insufficient_funds' | 'declined' | 'network'; message: string };

export interface PaymentProvider {
  readonly name: string;
  readonly simulated: boolean;
  commit(req: CommitRequest, ctx: { balance: number; forceFailure: boolean }): Promise<PaymentResult>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'Simulated';
  readonly simulated = true;

  async commit(req: CommitRequest, ctx: { balance: number; forceFailure: boolean }): Promise<PaymentResult> {
    await wait(1100); // long enough to feel like a real hold being placed
    if (ctx.forceFailure) {
      return {
        ok: false,
        code: 'declined',
        message: 'Your card was declined (simulated). Nothing was charged. Turn off "Simulate payment failure" in Settings to continue.',
      };
    }
    if (req.amount > ctx.balance) {
      return {
        ok: false,
        code: 'insufficient_funds',
        message: `You have $${ctx.balance} in demo credit. Choose a smaller amount or reset the demo in Settings.`,
      };
    }
    return { ok: true, transactionId: `sim_${Date.now().toString(36)}`, amount: req.amount, simulated: true };
  }
}

export const payments: PaymentProvider = new SimulatedPaymentProvider();
