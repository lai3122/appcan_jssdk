"use strict";

/**
 * 此代码应该在 root 页面优先调用 (优先于 config.js)
 */
window._root_sysinit = 100;
appcan.ready(function () {
    appcan.xwin.clearLocStorageAndTempFiles();
    appcan.xwin.initLocStorage();

    appcan.iApp.prepare(true); // uexiAppRevisionAndOffice 插件有bug，其它window的回调都调用了 第一个window的回调
});
