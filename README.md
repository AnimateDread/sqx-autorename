# SQX AutoRename

A [StrategyQuant X](https://strategyquant.com) plugin that adds a single-click **Auto Rename** button to every databank toolbar.

Renames selected strategies using the format:

```text
TradingStyle_Ticker_Timeframe_001
```

For example: `Breakout_SP500_H4_001`, `Breakout_SP500_H4_002`, `Momentum_EURUSD_H1_001`

- Ticker and timeframe are read automatically from each strategy's backtest data
- Numbers are sequential and never duplicate existing names in the databank
- Mixed batches (multiple symbols/timeframes) each get their own counter

---

## Installation

Copy the contents of this repo into:

```text
<SQX_install>/user/extend/Plugins/AutoRename/
```

So you have:

```text
user/extend/Plugins/AutoRename/
  AutoRenamePlugin.java
  AutoRenameServlet.java
  ui/
    module.js
```

That's it — no other folders need to be touched.

### Compile & restart

1. Open StrategyQuant X
2. Go to **Code Editor → Plugins**, select `AutoRename`, and click **Compile**
3. Restart SQX

The **Auto Rename** button will appear in the databank toolbar to the right of the Tools menu.

---

## Usage

1. Select one or more strategies in any databank
2. Click **Auto Rename**
3. Enter a Trading Style (e.g. `Breakout`, `Momentum`, `Counter_Trend`)
4. The preview shows the exact names that will be assigned
5. Click **Rename**

---

## Compatibility

Tested on StrategyQuant X Build 143.
