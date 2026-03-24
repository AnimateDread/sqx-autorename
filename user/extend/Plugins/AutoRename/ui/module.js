angular.module('app.resultsdatabankactions.autorename', ['sqplugin'])

// ── Button registration ───────────────────────────────────────────────────────
.config(function(sqPluginProvider) {

    sqPluginProvider.plugin("ResultsDatabankAction", 71, {
        title: "Auto Rename",
        class: 'btn btn-normal btn-default',
        controller: btnCtrl,
        id: "databank-action-autorename"
    });

    sqPluginProvider.addPopupWindow('autorename-popup', 'AutoRenamePopupCtrl', 'SQUANT');

    function btnCtrl($rootScope, $scope, DatabankActionsService, L, SQConstants) {

        $scope.onClick = function() {
            if ($rootScope.project.state != projectStates.loading && $rootScope.project.state != projectStates.running) {

                if (!DatabankActionsService.selectedStrategies) {
                    $rootScope.showError(L.tsq("You have to select at least one strategy to rename."));
                    return;
                }

                window.parent.broadcastEvent("showAutoRenamePopup", {});

            } else {
                $rootScope.showError(L.tsq("Cannot rename strategies when project is in loading/running state"));
            }
        };

        var projectStates = SQConstants.getConstants().runningStatuses;
    }
})

// ── Styles + Template ─────────────────────────────────────────────────────────
.run(function($templateCache) {

    // Inject styles directly so no external CSS file is needed
    var style = document.createElement('style');
    style.textContent =
        '#autoRenamePopup .modal-dialog { width: 440px; }' +
        '#autoRenamePopup .ar-preview { margin-top: 16px; padding: 10px 12px; background: #f5f5f5; border-radius: 4px; font-size: 13px; }' +
        '#autoRenamePopup .ar-preview-label { font-weight: bold; color: #555; margin-bottom: 4px; }' +
        '#autoRenamePopup .ar-preview-names strong { color: #337ab7; }' +
        '#autoRenamePopup .ar-hint { margin-top: 6px; color: #888; font-size: 11px; }' +
        '#autoRenamePopup .ar-preview-empty { color: #aaa; font-style: italic; }';
    document.head.appendChild(style);

    // Embed popup HTML directly so no external HTML file or internal/plugins/ path is needed
    $templateCache.put('autorename-popup',
        '<div class="modal" id="autoRenamePopup" tabindex="-1" role="dialog" aria-labelledby="autoRenameModalLabel">' +
        '  <div class="modal-dialog" role="document">' +
        '    <div class="modal-content">' +
        '      <div class="modal-header">' +
        '        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
        '        <h4 class="modal-title" id="autoRenameModalLabel"><tsq>Auto Rename</tsq> &mdash; {{count}} <tsq>strategies selected</tsq></h4>' +
        '      </div>' +
        '      <div class="modal-body">' +
        '        <form class="form-horizontal" role="form">' +
        '          <label class="sqn-label">' +
        '            <tsq>Trading Style</tsq>' +
        '            <input type="text" class="sqn-input" ng-model="config.style" placeholder="e.g. Breakout" ng-change="onStyleChange()" />' +
        '          </label>' +
        '          <div class="ar-preview" ng-if="preview.example">' +
        '            <div class="ar-preview-label"><tsq>Preview</tsq></div>' +
        '            <div class="ar-preview-names"><strong>{{preview.example}}</strong>, <strong>{{preview.example2}}</strong>, ...</div>' +
        '            <div class="ar-hint"><tsq>Ticker and timeframe are read from each strategy.</tsq> <tsq>Numbers continue from the highest existing name.</tsq></div>' +
        '          </div>' +
        '          <div class="ar-preview ar-preview-empty" ng-if="!preview.example && config.style"><tsq>Loading preview...</tsq></div>' +
        '        </form>' +
        '      </div>' +
        '      <div class="modal-footer">' +
        '        <a data-dismiss="modal" tsq>Close</a>' +
        '        <button type="button" class="btn btn-primary" ng-click="onRename()" ng-disabled="!config.style" tsq>Rename</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>'
    );
})

// ── Popup controller ──────────────────────────────────────────────────────────
.controller('AutoRenamePopupCtrl',
    function ($scope, $rootScope, $timeout, SQEvents, L, DatabankActionsService, BackendService, AppService) {

    var previewTimer = null;

    $scope.onStyleChange = function() {
        $scope.preview = {};

        if (!$scope.config.style || !$scope.config.style.trim()) return;

        if (previewTimer) $timeout.cancel(previewTimer);

        previewTimer = $timeout(function() {
            var strategies = $scope.config.strategies
                ? $scope.config.strategies.split(',')
                : [];

            if (strategies.length === 0) return;

            var params = {
                projectName:   $scope.config.projectName,
                databankName:  $scope.config.databankName,
                firstStrategy: strategies[0].trim(),
                style:         $scope.config.style.trim()
            };

            BackendService.sendRequest('/autorename/preview', params, function(result) {
                if (result && result.example) {
                    $scope.preview = result;

                    var n = parseInt(result.nextNumber) + 1;
                    $scope.preview.example2 = result.prefix + '_' + pad(n, 3);

                    try { $scope.$digest(); } catch (e) {}
                }
            }, 'POST');
        }, 350);
    };

    $scope.onRename = function() {
        if (!$scope.config.style || !$scope.config.style.trim()) return;

        $rootScope.setProgressInfo("Auto renaming strategies", "");

        var params = {
            projectName:  $scope.config.projectName,
            databankName: $scope.config.databankName,
            strategies:   $scope.config.strategies,
            style:        $scope.config.style.trim()
        };

        BackendService.sendRequest('/autorename/rename', params, function() {
            hidePopup('#autoRenamePopup');
        }, 'POST');
    };

    function onEvent(event, data) {
        if (event === 'showAutoRenamePopup') {
            if (!isPopupOpen('#autoRenamePopup')) {
                $scope.config.projectName  = AppService.getProject();
                $scope.config.databankName = AppService.getDatabank().title;
                $scope.config.strategies   = DatabankActionsService.selectedStrategies;
                $scope.config.style        = '';

                $scope.count = $scope.config.strategies
                    ? $scope.config.strategies.split(',').length
                    : 0;

                $scope.preview = {};

                try { $scope.$digest(); } catch (e) {}
                showPopup('#autoRenamePopup');
            }
        }
    }

    function pad(n, digits) {
        var s = String(n);
        while (s.length < digits) s = '0' + s;
        return s;
    }

    $scope.$on('$destroy', function() {
        SQEvents.removeListener(listenerId);
        if (previewTimer) $timeout.cancel(previewTimer);
    });

    $scope.config  = { projectName: null, databankName: null, strategies: null, style: '' };
    $scope.preview = {};
    $scope.count   = 0;

    var listenerId = 'AutoRenamePopupCtrl-' + window.appConfig.product;
    SQEvents.addListener(listenerId, ['showAutoRenamePopup'], onEvent);
});
