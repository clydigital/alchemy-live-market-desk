/* Instrumentation added under NODE_ENV === 'test' or when process.env.ALCHEMY_DIAG === '1'.
   This file adds minimal provider-level diagnostics for getMarketData and loadMarketMonitor
   and exports small accessors used by tests.

   Create diff minimal and reversible. No behavioral changes to provider logic.
*/

// Changes will be applied inline to lib/market.ts and lib/market-monitor.ts via separate commits.
