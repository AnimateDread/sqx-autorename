package com.strategyquant.userplugins.autorename;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.strategyquant.tradinglib.Databank;
import com.strategyquant.tradinglib.ResultsGroup;
import com.strategyquant.tradinglib.project.ProjectEngine;
import com.strategyquant.tradinglib.project.SQProject;
import com.strategyquant.tradinglib.project.websocket.channels.ProjectChannels;
import com.strategyquant.webguilib.servlet.HttpJSONServlet;

class AutoRenameServlet extends HttpJSONServlet {

    private static final Logger Log = LoggerFactory.getLogger(AutoRenameServlet.class);
    private static final Pattern NAME_TF_PATTERN = Pattern.compile("(.+?)[_/ -]([MHDW]\\d+)$", Pattern.CASE_INSENSITIVE);

    @Override
    protected String execute(String command, Map<String, String[]> parameterMap, String method) throws Exception {
        switch (command) {
            case "rename":  return onRename(parameterMap);
            default:
                throw new Exception("Unknown command '" + command + "'.");
        }
    }

    // -------------------------------------------------------------------------
    // /autorename/rename
    //
    // For each selected strategy:
    //   1. Read its mainResultKey  (e.g. "Main: SP500_dukascopy_the5ers/H4")
    //   2. Parse to ticker+TF      = "SP500_H4"  (strips "Word: " prefix,
    //                                datafeed/broker suffix, keeps ticker+TF)
    //   3. Build prefix            = style + "_" + ticker + "_" + TF
    //   4. Find highest existing   prefix_NNN name in the databank
    //   5. Rename to               prefix_(next number, 3 digits)
    //
    // Strategies with different tickers/timeframes each get their own counter,
    // so mixed-symbol batches are handled correctly and names are always unique.
    // -------------------------------------------------------------------------

    private String onRename(Map<String, String[]> args) throws Exception {
        checkParamExists(args, new String[]{"projectName", "databankName", "strategies", "style"});

        String projectName  = tryGetParamValue(args, "projectName");
        String databankName = tryGetParamValue(args, "databankName");
        String strategies   = getParam(args, "strategies", "all");
        String style        = sanitize(tryGetParamValue(args, "style"));

        SQProject project  = getProject(projectName);
        Databank  databank = getDatabank(project, databankName);
        String[]  stgs     = resolveStrategies(strategies, databank);

        if (stgs.length == 0) {
            JSONObject response = new JSONObject();
            response.put("success", "ok");
            response.put("renamed", 0);
            response.put("skipped", 0);
            return response.toString();
        }

        // Track the "next number" per prefix across this batch
        // so that two strategies with the same ticker+TF get consecutive numbers.
        Map<String, Integer> nextNumCache = new HashMap<>();

        String lockName   = "AutoRenameStrategies";
        String actionName = "AutoRenameStrategies";

        project.publisher.resetLastData(ProjectChannels.PROGRESS_CHANNEL);
        project.getProgress().update(actionName, 0, null);

        int renamed = 0;
        int skipped = 0;

        for (int i = 0; i < stgs.length; i++) {
            String strategyName = stgs[i].trim();
            ResultsGroup rg = null;

            try {
                rg = databank.getLocked(strategyName, lockName);
                ResultsGroup newRg = rg.clone();

                String resultKey = extractTickerTF(rg.getMainResultKey(), rg.getName()); // e.g. "SP500_H4"
                String prefix    = style + "_" + resultKey;                  // e.g. "Breakout_SP500_H4"

                // First time we see this prefix: scan databank for the highest used number
                if (!nextNumCache.containsKey(prefix)) {
                    nextNumCache.put(prefix, findNextNumber(databank, prefix));
                }

                int num = nextNumCache.get(prefix);
                nextNumCache.put(prefix, num + 1);

                newRg.setName(buildName(prefix, num));

                databank.remove(strategyName, true, true, false, true, lockName);
                databank.add(newRg, true);
                renamed++;

            } catch (Exception e) {
                Log.error("Error while renaming strategy '" + strategyName + "'", e);
                skipped++;
            } finally {
                if (rg != null) rg.releaseLock(lockName);

                int percent = (int) ((i + 1.0) / stgs.length * 100);
                project.getProgress().update(actionName, percent, null);
            }
        }

        project.getProgress().update(actionName, 100, null);

        JSONObject response = new JSONObject();
        response.put("success", "ok");
        response.put("renamed", renamed);
        response.put("skipped", skipped);
        return response.toString();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private SQProject getProject(String projectName) throws Exception {
        if (!ProjectEngine.projectExists(projectName)) {
            throw new Exception("Project '" + projectName + "' doesn't exist.");
        }
        return ProjectEngine.get(projectName);
    }

    private Databank getDatabank(SQProject project, String databankName) throws Exception {
        if (!project.getDatabanks().containsKey(databankName)) {
            throw new Exception("Databank '" + databankName + "' doesn't exist.");
        }
        return project.getDatabanks().get(databankName);
    }

    private String[] resolveStrategies(String strategies, Databank databank) {
        if (strategies == null) return new String[0];

        String raw = strategies.trim();
        if (raw.isEmpty()) return new String[0];
        if ("all".equalsIgnoreCase(raw)) {
            return databank.getRecordKeys().toArray(new String[0]);
        }

        Set<String> resolved = new LinkedHashSet<>();

        if (raw.startsWith("[") && raw.endsWith("]")) {
            try {
                org.json.JSONArray arr = new org.json.JSONArray(raw);
                for (int i = 0; i < arr.length(); i++) {
                    String key = String.valueOf(arr.opt(i)).trim();
                    if (!key.isEmpty()) resolved.add(key);
                }
                return resolved.toArray(new String[0]);
            } catch (Exception ignored) {
                // Fall back to legacy CSV parsing.
            }
        }

        String[] stgs = raw.split(",");
        for (String stg : stgs) {
            String key = stg.trim();
            if (!key.isEmpty()) resolved.add(key);
        }
        return resolved.toArray(new String[0]);
    }

    /**
     * Parses getMainResultKey() into "TICKER_TF".
     *
     * Input examples:
     *   "Main: SP500_dukascopy_the5ers/H4"  →  "SP500_H4"
     *   "EURUSD_H1"                          →  "EURUSD_H1"  (no slash → returned as-is)
     *
     * Rules:
     *   1. Strip any "Word: " prefix (e.g. "Main: ")
     *   2. Split on "/" → left = ticker_datafeed_broker, right = timeframe
     *   3. Keep only the first "_"-delimited segment of the ticker (drops datafeed/broker)
     */
    private String extractTickerTF(String mainResultKey, String strategyName) {
        String key = mainResultKey != null ? mainResultKey.trim() : "";

        if (key.isEmpty()) {
            return inferTickerTFFromName(strategyName);
        }

        // Strip "Word: " prefix if present
        int colonIdx = key.indexOf(": ");
        if (colonIdx >= 0) key = key.substring(colonIdx + 2).trim();

        // Split on "/" to separate ticker_datafeed_broker from timeframe
        int slashIdx = key.indexOf('/');
        if (slashIdx < 0) {
            String normalized = normalizeTickerTF(key);
            return normalized != null ? normalized : inferTickerTFFromName(strategyName);
        }

        String tickerFull = key.substring(0, slashIdx);   // "SP500_dukascopy_the5ers"
        String tf         = key.substring(slashIdx + 1);  // "H4"

        // Keep only first segment of ticker (before first "_")
        int underIdx = tickerFull.indexOf('_');
        String ticker = underIdx >= 0 ? tickerFull.substring(0, underIdx) : tickerFull;

        String normalized = normalizeTickerTF(ticker + "_" + tf);
        return normalized != null ? normalized : inferTickerTFFromName(strategyName);
    }

    private String inferTickerTFFromName(String strategyName) {
        String fallback = strategyName == null ? "UNKNOWN_H1" : strategyName.trim();
        if (fallback.isEmpty()) return "UNKNOWN_H1";

        Matcher m = NAME_TF_PATTERN.matcher(fallback);
        if (!m.find()) return "UNKNOWN_H1";

        String ticker = m.group(1).replaceAll("[^A-Za-z0-9]+", "").toUpperCase();
        String tf = m.group(2).toUpperCase();
        if (ticker.isEmpty()) ticker = "UNKNOWN";
        return ticker + "_" + tf;
    }

    private String normalizeTickerTF(String key) {
        String cleaned = key == null ? "" : key.trim();
        if (cleaned.isEmpty()) return null;

        String[] parts = cleaned.split("_");
        if (parts.length < 2) return null;

        String tf = parts[parts.length - 1].replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        String ticker = parts[0].replaceAll("[^A-Za-z0-9]", "").toUpperCase();

        if (ticker.isEmpty() || tf.isEmpty()) return null;
        return ticker + "_" + tf;
    }

    /**
     * Scans all strategy names for "{prefix}_NNN" and returns the next available number.
     * Always returns at least 1.
     */
    private int findNextNumber(Databank databank, String prefix) {
        String matchPrefix = prefix + "_";
        int max = 0;
        for (String name : databank.getRecordKeys()) {
            if (name.startsWith(matchPrefix)) {
                try {
                    int n = Integer.parseInt(name.substring(matchPrefix.length()));
                    if (n > max) max = n;
                } catch (NumberFormatException ignored) {}
            }
        }
        return max + 1;
    }

    /** Builds "prefix_001". Always 3-digit zero-padded. */
    private String buildName(String prefix, int number) {
        return prefix + "_" + String.format("%03d", number);
    }

    /**
     * Sanitizes user input for use in a filename/strategy name:
     * trims whitespace, replaces spaces with underscores, strips unsafe characters.
     */
    private String sanitize(String s) {
        String clean = s == null ? "" : s.trim().replaceAll("\\s+", "_").replaceAll("[^A-Za-z0-9_\\-]", "");
        if (clean.isEmpty()) {
            return "Style";
        }
        return clean;
    }
}
