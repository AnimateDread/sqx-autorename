# SQX AutoRename

A [StrategyQuant X](https://strategyquant.com) plugin that adds a single-click **Auto Rename** button to every databank toolbar.

Renames selected strategies using the format:

```
TradingStyle_Ticker_Timeframe_001
```

For example: `Breakout_SP500_H4_001`, `Breakout_SP500_H4_002`, `Momentum_EURUSD_H1_001`

- Ticker and timeframe are extracted automatically from each strategy's backtest data
- Numbers are sequential and never duplicate existing names in the databank
- Mixed batches (multiple symbols/timeframes) each get their own counter

---

## Installation

### Option A — Import .sxp (recommended)

1. Download `AutoRename.sxp` from this repo
2. In SQX go to **Code Editor → Plugins → Import** and select the file
3. Restart SQX

### Option B — Copy source files manually

Download this repo and copy the `user` folder directly into your SQX installation directory:

```
<SQX_install>/
  user/
    extend/
      Plugins/
        AutoRename/
          AutoRenamePlugin.java
          AutoRenameServlet.java
          ui/
            module.js
```

Then compile:

1. Open StrategyQuant X
2. Go to **Code Editor → Plugins**, select `AutoRename`, and click **Compile**
3. Restart SQX

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
