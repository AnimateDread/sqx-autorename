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
        '            <input type="text" class="sqn-input" ng-model="config.style" placeholder="e.g. Breakout" />' +
        '          </label>' +
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
    function ($scope, $rootScope, SQEvents, DatabankActionsService, BackendService, AppService) {

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
                $scope.config.strategiesRaw = DatabankActionsService.selectedStrategies;

                var selectedKeys = parseStrategyKeys($scope.config.strategiesRaw);
                $scope.config.strategies = selectedKeys.length
                    ? JSON.stringify(selectedKeys)
                    : 'all';
                $scope.config.style        = '';

                $scope.count = selectedKeys.length;

                try { $scope.$digest(); } catch (e) {}
                showPopup('#autoRenamePopup');
            }
        }
    }

    function parseStrategyKeys(rawSelection) {
        if (angular.isArray(rawSelection)) {
            return rawSelection.filter(function(item) {
                return !!item && String(item).trim().length > 0;
            }).map(function(item) {
                return String(item).trim();
            });
        }

        if (typeof rawSelection === 'string') {
            try {
                var arr = JSON.parse(rawSelection);
                if (angular.isArray(arr)) {
                    return arr.filter(function(item) {
                        return !!item && String(item).trim().length > 0;
                    }).map(function(item) {
                        return String(item).trim();
                    });
                }
            } catch (e) {}

            if (rawSelection.trim()) {
                return rawSelection.split(',').map(function(item) {
                    return item.trim();
                }).filter(function(item) {
                    return item.length > 0;
                });
            }
        }

        return [];
    }

    $scope.$on('$destroy', function() {
        SQEvents.removeListener(listenerId);
    });

    $scope.config  = { projectName: null, databankName: null, strategiesRaw: null, strategies: null, style: '' };
    $scope.count   = 0;

    var listenerId = 'AutoRenamePopupCtrl-' + window.appConfig.product;
    SQEvents.addListener(listenerId, ['showAutoRenamePopup'], onEvent);
});
