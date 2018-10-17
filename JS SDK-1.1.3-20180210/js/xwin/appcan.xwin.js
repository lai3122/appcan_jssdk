"use strict";

/**
 * @preserve
 * @author: lsd
 * @email: lai3122@qq.com
 * @description: 构建appcan xwin 模块
 * @created: 2018.3.22
 * @update: 2018.3.26
 */

/*global uexWindow, uexFileMgr, uexWidgetOne, uexXmlHttpMgr*/

/**@preserve
 * window.appConfig {Object}
 *    serverUrl       服务端地址
 *    serverIndex     默认的服务端地址 index
 *    downloadUrlTemplate   服务端文件下载地址模板
 *    tokenType       会话维持的方式: JSESSIONID, param 或 header
 *    loginUrl        login url
 *    logoutUrl       logout url
 *    debugTokenId    用于appcan编辑调试
 */
var xwin = appcan.xwin = {
    opener: null, // opener窗口名字
    current: null, // 当前窗口名字

    // JSESSIONID 方式的话将在 url 附加 JSESSIONID=...,
    // param 方式, 如 "__sid", 将会在 url 的 querystr 附加 __sid=...
    // header 方式, 如 {Auth: "?"}, 就在 http header 里添加 header： "Auth：..."
    _tokenType: "JSESSIONID", // 默认值
    // tokenType : '__sid',
    // tokenType : {Auth: "?"},

    onClose: null, // {function} close 窗口事件
    wgtPath: null, // wgt:// 对应的地址
    tempDir: appcan.file.wgtPath + "temp/dummyTempdir/",

    /**@preserve
     * 返回一个序列值
     * @return  {int}
     */
    getUID: function () {
        var maxId = 65536;
        var uid = 0;
        return function () {
            uid = (uid + 1) % maxId;
            return uid;
        };
    }(),

    /**@preserve
     * open 打开一个新窗口
     * @param wnd       {String=}  窗口的名字, 无此参数或 "auto" ==> 自动取名
     * @param url       {String}  要加载的地址
     * @param param     {json}    传入参数，以备新开的窗口使用
     * @param aniId     {Integer} 动画效果
     * @param type      {Integer} 窗口的类型
     * @param animDuration {Integer} 动画时长
     */
    open: function (wnd, url, param, aniId, type, animDuration) {
        if (arguments.length === 1 && $.tppe(wnd) === "object") {
            var argObj = wnd;
            wnd = argObj.wnd;
            url = argObj.url;
            param = argObj.param;
            aniId = argObj.aniId;
            type = argObj.type;
            animDuration = argObj.animDuration;
        } else if (arguments.length === 1) {
            url = wnd;
            wnd = "auto";
        } else if ($.type(url) === "object") {
            animDuration = type;
            type = aniId;
            aniId = param;
            param = url;
            url = wnd;
            wnd = "auto";
        }

        if (wnd === "auto" || $.type(wnd) !== "string") {
            var i = appcan.locStorage.getVal("xwin.nextVal");
            if (i == null) i = 1; else i = eval(i);
            appcan.locStorage.setVal("xwin.nextVal", i + 1);
            wnd = "aw" + i;
        }

        appcan.locStorage.setVal("xwin.opener", this.current);
        appcan.locStorage.setVal("xwin.current", wnd);

        var wndList = JSON.parse(appcan.locStorage.getVal("xwin.wndList"));
        if (wndList == null) wndList = [];

        var j = $.inArray(wnd, wndList);
        if (j < 0) {
            wndList.push(wnd);
            appcan.locStorage.setVal("xwin.wndList", JSON.stringify(wndList));
        }

        if (param !== undefined) this.param = param;
        appcan.openWinWithUrl(wnd, url, aniId, (type) ? type : 4, animDuration);
    },

    /**@preserve
     * close 关闭窗口
     * @param wnd  {String}  窗口名字
     * 说明:
     * 'current'  或无wnd参数，就关闭当前窗口，
     * 'opener'   关闭 opener 窗口
     * 'all'      关闭所有窗口
     * 其它，     关闭指定名字的窗口
     */
    close: function (wnd) {
        var wndList;

        if (arguments.length === 0 || wnd === "current") {
            wnd = this.current;
            this._deleteTempFiles();
            if (wnd === "root") {
                appcan.window.evaluateScript(wnd, 'location.reload()');
            } else {
                appcan.window.close(-1);
                if (wnd) {
                    wndList = JSON.parse(appcan.locStorage.getVal("xwin.wndList"));
                    if (wndList == null) wndList = [];
                    var i = $.inArray(wnd, wndList);
                    if (i >= 0) {
                        wndList.splice(i, 1);
                        appcan.locStorage.setVal("xwin.wndList", JSON.stringify(wndList));
                    }
                }
                if (appcan.isFunction(this.onClose)) {
                    this.onClose();
                }
            }
        } else if (wnd === "opener") {
            wnd = this.opener;
            appcan.window.evaluateScript(wnd, 'appcan.xwin.close()');
        } else if (wnd === "all") {
            wndList = JSON.parse(appcan.locStorage.getVal("xwin.wndList"));
            if (wndList == null) wndList = [];

            for (; wndList.length > 0;) {
                wnd = wndList.pop();
                appcan.window.evaluateScript(wnd, 'appcan.xwin.close()');
            }
        } else {
            appcan.window.evaluateScript(wnd, 'appcan.xwin.close()');
        }
    },

    /**@preserve
     * closeOpener  关闭 opener 窗口
     */
    closeOpener: function () {
        this.close("opener");
    },

    /**@preserve
     * closeAll     关闭所有窗口
     */
    closeAll: function () {
        this.close("all");
    },

    /**@preserve
     * serverUrl    服务端地址
     * @return  {array}
     */
    get serverUrl() {
        if (!this._serverUrl) {
            var value = window.appConfig.serverUrl;
            if ($.type(value) === "string") value = [value];
            this._serverUrl = value;
            if (this.serverIndex < 0 || this.serverIndex >= this._serverUrl.length) this.serverIndex = 0;
        }
        return this._serverUrl;
    }, _serverUrl: null,

    /**@preserve
     * downloadUrlTemplate  服务端文件下载地址模板
     * @return  {array}
     */
    get downloadUrlTemplate() {
        if (!this._downloadUrlTemplate) {
            var value = window.appConfig.downloadUrlTemplate;
            if ($.type(value) === "string") value = [value];
            this._downloadUrlTemplate = value;
        }
        return this._downloadUrlTemplate;
    }, _downloadUrlTemplate: null,

    /**@preserve
     * serverIndex 当前选用的server索引
     * @param value {Integer}
     */
    set serverIndex(value) {
        appcan.locStorage.setVal("xwin.serverIndex", value);
    },
    /**@preserve
     * serverIndex 当前选用的server索引
     * @return  {Integer}
     */
    get serverIndex() {
        var value = appcan.locStorage.getVal("xwin.serverIndex");
        if (value == null) {
            value = window.appConfig.serverIndex;
            value = value ? eval(value) : 0;
            if (value < 0 || value >= this._serverUrl.length) value = 0;
            return value;
        } else {
            return eval(value);
        }
    },

    /**@preserve
     * tokenType 会话维持的方式: JSESSIONID, param 或 header
     * @return  {String|Object}
     */
    get tokenType() {
        var tokenType = window.appConfig.tokenType;
        if (tokenType) return tokenType;
        return this._tokenType;
    },

    /**@preserve
     * param 窗口间传递参数，保存的数据在新窗口才可用
     * @param value {json}
     */
    set param(value) {
        appcan.locStorage.setVal("xwin.param", JSON.stringify(value));
    },
    /**@preserve
     * param 窗口间传递参数
     * @return  {json}
     */
    get param() {
        return this._param;
    }, _param: {},

    /**@preserve
     * prepare 执行窗口初始化操作
     */
    prepare: function () {
        var wgtPath = appcan.locStorage.getVal("xwin.wgtPath");
        if (!wgtPath) {
            appcan.file.getRealPath(appcan.file.wgtPath, function (err, s, dataType, optId) {
                if (err) return;
                if (s.length > 0 && s.charAt(s.length - 1) !== "/") s += "/";
                appcan.locStorage.setVal("xwin.wgtPath", s);
                appcan.xwin.wgtPath = s;
            });
        } else {
            this.wgtPath = wgtPath;
        }

        this.opener = appcan.locStorage.getVal("xwin.opener");
        this.current = appcan.locStorage.getVal("xwin.current");

        if (this.opener === null && this.current === null) {
            this.opener = "";
            this.current = "root";
        }

        var _param = appcan.locStorage.getVal("xwin.param");
        appcan.locStorage.remove("xwin.param"); // 取出即删除
        if (_param === null) _param = {};
        else _param = JSON.parse(_param);
        this._param = _param;

        this.tempDir = appcan.file.wgtPath + "temp/" + this.current + "/";

        this._deleteTempFiles();

        uexWindow.setReportKey(0, 1);
        uexWindow.onKeyPressed = function (keyCode) {
            if (keyCode === 0 /*back key*/) {
                var thiz = appcan.xwin;
                if (thiz.current === "root") {
                    thiz.clearLocStorageAndTempFiles();
                    uexWidgetOne.exit(0);
                } else if (thiz.current === "index") {
                    if (window.logoutClickCount && window.logoutClickCount > 0) {
                        thiz.logout();
                    } else {
                        uexWindow.toast(0, 8, '再按一次退出应用', 2000);
                        window.logoutClickCount = 1;
                        setTimeout(function () {
                            window.logoutClickCount = undefined;
                        }, 2000);
                    }
                } else {
                    appcan.xwin.close();
                }
            }
        };

        // backkey / left_btn
        $(".backkey, .left_btn").click(function () {
            appcan.xwin.close();
        });

    },

    /**@preserve
     * httpUrl 转换为一个绝对的地址，并根据需要附带 TOKENID
     * @param url   {String}
     * @return      {String}
     */
    httpUrl: function (url) {
        var serverUrl = this.serverUrl[this.serverIndex];
        if (serverUrl.charAt(serverUrl.length - 1) !== "/") serverUrl += "/";
        if (url.length > 0 && url.charAt(0) === "/") url = url.substring(1);

        if (url.indexOf("://") < 0) {
            url = serverUrl + url;
        } else {
            // return url; // 重复调用 httpUrl() !
        }

        if (typeof this.tokenType === "string") {
            var tokenId = this.tokenId || window.appConfig.debugTokenId;
            if (tokenId) {
                var i = url.indexOf("?");

                if (this.tokenType === "JSESSIONID") {
                    if (i < 0) i = url.indexOf("#");
                    if (i < 0) i = url.length;
                    var j = url.indexOf(";");

                    if (j < 0 || j > i) {
                        url = url.substring(0, i) + ";" + hiz.tokenType + "=" + tokenId + url.substring(i);
                    } else {
                        url = url.substring(0, j) + ";" + hiz.tokenType + "=" + tokenId + url.substring(i);
                    }
                } else {
                    if (i >= 0) {
                        url = url.substring(0, i + 1) + this.tokenType + "=" + tokenId + "&" + url.substring(i + 1);
                    } else {
                        var k = url.indexOf("#");
                        if (k < 0) url = url + "?" + this.tokenType + "=" + tokenId;
                        else url = url.substring(0, k) + "?" + this.tokenType + "=" + tokenId + url.substring(k);
                    }
                }
            }
        }
        return url;
    },

    /**@preserve
     * downloadUrl 转换为一个绝对的文件下载地址，并根据需要附带 TOKENID
     * @param url   {String}
     * @return      {String}
     */
    downloadUrl: function (url) {
        var template = this.downloadUrlTemplate[this.serverIndex];
        var s;
        if (template.indexOf('?') >= 0) {
            s = template.replace(/\$s/g, $.param({a: url}).substring(2));
        } else {
            s = template.replace(/\$s/g, url);
        }
        return this.httpUrl(s);
    },

    /**@preserve
     * POST 提交请求
     * @param url       {String}
     * @param data      {json}  上传文件的话，指定参数值为 object, 如 {path:'/path/file.jpg'}
     * @param callback  {function(data)}
     * @param progressCallback  {function(progress)}
     */
    post: function (url, data, callback, progressCallback) {
        var msg_timeout = "操作超时,请重新登录"; // 会话超时了
        var msg_failed = "请求数据失败了";  // 服务端获取数据出现了问题，没有得到数据
        var msg_error = "请求过程中发生错误了"; // 一般是网络故障或服务端物理故障不能完成请求

        var options = {};
        options.type = "POST";
        options.url = this.httpUrl(url);
        options.data = data; //
        options.success = function (data, status, requestCode, response, xhr) {
            uexWindow.closeToast();
            var result = JSON.parse(data);
            if (result.code === Result.TIMEOUT) {
                uexWindow.toast(0, 8, msg_timeout, 4000);
                window.setTimeout(function () {
                    appcan.xwin.closeAll(); // 关闭所有窗口
                }, 1500);
                return;
            } else if (result.code === Result.FAILED) {
                var msg = result.msg;
                if (!msg || msg.toLowerCase().indexOf("failed") >= 0) msg = msg_failed;
                uexWindow.toast(0, 8, msg, 4000);
                return;
            }
            callback(result.data)
        };
        options.error = function (xhr, errorType, error, msg) {
            uexWindow.toast(0, 8, msg_error, 4000);
        };
        if ($.type(progressCallback) === "function") {
            options.progress = function (progress, xhr) {
                progressCallback(progress);
            }
        }

        if ($.type(this.tokenType) === "object") {
            var tokenId = this.tokenId || window.appConfig.debugTokenId;
            if (tokenId) {
                options.headers = {};
                for (var key in this.tokenType) {
                    options.headers[key] = this.tokenType[key].replace(/\?/g, tokenId);
                }
            }
        }

        appcan.ajax(options);
    },

    /**@preserve
     * post2 提交请求, 与 post 完成一样的功能
     * @param url       {String}
     * @param data      {json}  上传文件的话，指定参数值为 object, 如 {path:'/path/file.jpg'}
     * @param callback  {function(data)}
     * @param progressCallback  {function(progress)}
     */
    post2: function (url, data, callback, progressCallback) {
        var msg_timeout = "操作超时,请重新登录"; // 会话超时了
        var msg_failed = "请求数据失败了";  // 服务端获取数据出现了问题，没有得到数据
        var msg_error = "请求过程中发生错误了"; // 一般是网络故障或服务端物理故障不能完成请求

        if ($.type(callback) === "function") {
            uexXmlHttpMgr.onData = function (reqId, status, result) {
                uexXmlHttpMgr.close(reqId);

                if (status === -1) { // -1=error 0=receive 1=finish
                    uexWindow.toast(0, 8, msg_error, 4000);
                    return;
                }

                uexWindow.closeToast();

                result = JSON.parse(result);
                if (result.code === Result.TIMEOUT) {
                    uexWindow.toast(0, 8, msg_timeout, 4000);
                    window.setTimeout(function () {
                        appcan.xwin.closeAll(); // 关闭所有窗口
                    }, 1500);
                    return;
                } else if (result.code === Result.FAILED) {
                    var msg = result.msg;
                    if (!msg || msg.toLowerCase().indexOf("failed") >= 0) msg = msg_failed;
                    uexWindow.toast(0, 8, msg, 4000);
                    return;
                }

                callback(result.data);
            };
        } else {
            uexXmlHttpMgr.onData = null;
        }

        if ($.type(progressCallback) === "function") {
            uexXmlHttpMgr.onPostProgress = function (reqId, progress) {
                progressCallback(progress);
            }
        } else {
            uexXmlHttpMgr.onPostProgress = null;
        }

        var reqId = this.getUID();
        uexXmlHttpMgr.open(reqId, 'POST', this.httpUrl(url), '');

        if ($.type(data) === "object") {
            for (var key in data) {
                headers[key] = this.tokenType[key].replace(/\?/g, tokenId);
                var value = data[key];
                if ($.type(value) === "object" && value.path) {
                    uexXmlHttpMgr.setPostData(reqId, 1, key, value.path); // binary
                } else {
                    uexXmlHttpMgr.setPostData(reqId, 0, key, value);
                }
            }
        } else {
            uexXmlHttpMgr.setBody(reqId, data);
        }

        if ($.type(this.tokenType) === "object") {
            var tokenId = this.tokenId || window.appConfig.debugTokenId;
            if (tokenId) {
                var headers = {};
                for (var key in this.tokenType) {
                    headers[key] = this.tokenType[key].replace(/\?/g, tokenId);
                }
                uexXmlHttpMgr.setHeaders(reqId, JSON.stringify(headers))
            }
        }

        uexXmlHttpMgr.send(reqId);
    },

    /**@preserve
     * logout
     * @param url   {String=} optional logout url
     */
    logout: function (url) {
        appcan.request.ajax({
            url: this.httpUrl(url || window.appConfig.logoutUrl || "logout"),
            type: 'POST',
            success: function (data, status, requestCode, response, xhr) {
                //alert('success');
            },
            error: function (xhr, errorType, error, msg) {
                //alert('error');
            },
            complete: function (xhr, status) {
                //alert('complete');
                appcan.xwin.clearLocStorageAndTempFiles();
                uexWidgetOne.exit(0);
            }
        });
    },

    /**@preserve
     * tokenId
     * @param value {String}
     */
    set tokenId(value) {
        appcan.locStorage.setVal("xwin.tokenId", value);
    },
    /**@preserve
     * tokenId
     * @return  {String}
     */
    get tokenId() {
        var value = appcan.locStorage.getVal("xwin.tokenId");
        if (value) return value;
        return "";
    },

    /**@preserve
     * loginName
     * @param value {String}
     */
    set loginName(value) {
        appcan.locStorage.setVal("persist.loginName", value);
    },
    /**@preserve
     * loginName
     * @return  {String}
     */
    get loginName() {
        var value = appcan.locStorage.getVal("persist.loginName");
        if (value) return value;
        return "";
    },

    /**@preserve
     * userName
     * @param value {String}
     */
    set userName(value) {
        appcan.locStorage.setVal("xwin.userName", value);
    },
    /**@preserve
     * userName
     * @return  String}
     */
    get userName() {
        var value = appcan.locStorage.getVal("xwin.userName");
        if (value) return value;
        return "";
    },

    /**@preserve
     * execute 跨窗口执行脚本
     * @param wnd     {String=}    可选项，窗口名字，为'opener'或false的值，表示opener窗口，其它值指定窗口名字
     * @param script  {String}    脚本
     * 说明: 还可以附加额外参数
     * 例子:
     * execute("hello(1)", 2); 在opener窗口执行 hello(1,2)
     * execute("hello()", 1, 2); 在opener窗口执行 hello(1,2)
     * execute(null, "hello()", 1, 2); null表示opener窗口，在opener窗口执行 hello(1,2)
     * execute("win", "hello()", {name: "jack", age: 28}, 20); 在名为win的窗口执行 hello({name: "jack", age: 28}, 20)
     */
    execute: function (wnd, script) {
        if (script === undefined) {
            script = wnd;
            wnd = this.opener;
        } else {
            var len;
            if (wnd && wnd.indexOf("(") >= 0) {
                // 第一个参数包括括号，认为wnd参数忽略了，第一个参数就是script
                script = wnd;
                wnd = this.opener;
                len = 1;
            } else {
                wnd = (wnd && (wnd !== "opener")) ? wnd : this.opener;
                len = 2;
            }

            if (arguments.length > len) { // 还有其它参数，认为是脚本函数的参数
                var param = "";
                var i = script.indexOf("(");
                if (i >= 0) {
                    var j = script.lastIndexOf(")");
                    param = script.substring(i + 1, j).trim();
                    script = script.substring(0, j);
                } else {
                    script += "(";
                }

                for (i = len; i < arguments.length; i++) {
                    if (i > len || param) script += ", ";
                    script += JSON.stringify(arguments[i]); // 不用传 function regexp, date 的话，请使用 date.getTime() 代替
                }
                script += ")";
            }
        }

        appcan.window.evaluateScript(wnd, script);
    },

    /**@preserve
     * deleteTempFiles 删除当前窗口的临时文件
     */
    _deleteTempFiles: function () {
        uexFileMgr.deleteFileByPath(this.tempDir);
    },

    /**@preserve
     * realPath 获取wgt url的真实路径
     * @param wgtUrl    {String} wgt://格式的 url
     * @return          {String}
     */
    realPath: function (wgtUrl) {
        if (wgtUrl.match(new RegExp("^" + appcan.file.wgtPath))) {
            return this.wgtPath + wgtUrl.substring(appcan.file.wgtPath.length);
        } else {
            return wgtUrl;
        }
    },

    /**@preserve
     * getFileProviderPath 得到对 SDCARD 的相对路径
     * @param wgtUrl    {String}    wgt://temp/doc1.doc
     * @return          {String}
     */
    fileProviderPath: function (wgtUrl) {
        var s = this.realPath(wgtUrl);
        s = s.replace(/.*\/(widgetone\/apps\/[0-9]+\/)/, "$1");
        return s;
    },

    /**@preserve
     * initLocStorage 初始化 locStorage, 用于 root 窗口，最开始就调用
     */
    initLocStorage: function () {
        this.opener = "";
        this.current = "root";

        appcan.locStorage.setVal("xwin.opener", this.opener);
        appcan.locStorage.setVal("xwin.current", this.current);
        appcan.locStorage.setVal("xwin.nextVal", "1");
        appcan.locStorage.setVal("xwin.wndList", JSON.stringify(["root"]));

        appcan.widgetOne.getCurrentWidgetInfo(function (err, data, dataType, opId) {
            if (err === null) { // 正确返回结果
                data = JSON.parse(data);
                appcan.locStorage.setVal("sys.appVersion", data.version);
            } else {
                appcan.locStorage.setVal("sys.appVersion", "error");
            }
        });

        appcan.device.getInfo(1, function (err, data, dataType, optId) {
            if (err === null) { // 正确返回结果
                var device = JSON.parse(data);
                var os = device.os.toLowerCase();

                if (os.substring(0, 7) === "android") {
                    appcan.locStorage.setVal("persist.deviceOs", "android");
                } else {
                    appcan.locStorage.setVal("persist.deviceOs", os);
                }
            } else {
                appcan.locStorage.setVal("persist.deviceOs", "error");
            }
        });

        appcan.file.getRealPath(appcan.file.wgtPath, function (err, s, dataType, optId) {
            if (err) return;
            if (s.length > 0 && s.charAt(s.length - 1) !== "/") s += "/";
            appcan.locStorage.setVal("xwin.wgtPath", s);
            appcan.xwin.wgtPath = s;
        });
    },

    /**@preserve
     * clearLocStorageAndTempFiles 清除 locStorage 和临时文件，在 logout 时调用
     */
    clearLocStorageAndTempFiles: function () {
        uexFileMgr.deleteFileByPath(appcan.file.wgtPath + "temp/");

        var keys = appcan.locStorage.keys();
        if (keys) for (var i = 0; i < keys.length; i++) {
            // 保留 persist.*
            if (!/^persist\..*$/.test(keys[i]))
                appcan.locStorage.remove(keys[i]);
        }
    },

    /**@preserve
     * appVersion 获取appVerion
     * @return  {String}
     * a) 如果返回null，说明系统获取 appVersion 还没有返回，请稍后时间再获取
     * b) 如果返回error，说明获取失败了
     */
    appVersion: function () {
        return appcan.locStorage.getVal("sys.appVersion");
    },

    /**@preserve
     * deviceOs 获取device OS
     * @return  {String}
     * a) 如果返回null，说明系统获取 device OS 还没有返回，请稍后时间再获取
     * b) 如果返回error，说明获取失败了
     */
    deviceOs: function () {
        return appcan.locStorage.getVal("persist.deviceOs");
    },

    /**@preserve
     * isAndroid 判断是否是 android 系统
     * @return  {boolean}
     */
    get isAndroid() {
        if (this._isAndroid === null) {
            var deviceOs = appcan.locStorage.getVal("persist.deviceOs");
            if (deviceOs === null) return null; // 还没有完成初始化
            this._isAndroid = deviceOs === "android";
        }
        return this._isAndroid;
    }, _isAndroid: null,

    /**@preserve
     * isAppInstalled 判断系统是否安装了指定的应用
     * @param name  {String} 应用名
     * @return      {boolean}
     */
    isAppInstalled: function (name) {
        return uexWidget.isAppInstalled(JSON.stringify({appData: name}));
    },

    /**@preserve
     * mapFileName 返回 url 匹配的文件名 用于下载保存文件时文件名的确定
     * @param url   {String}
     * @return      {string}
     * @desc url 如果只包含扩展名，每次获取都得到新文件名
     */
    mapFileName: function (url) {
        if (!url) return null;
        var result = this._mapFileName[url];
        if (result !== undefined) {
            return result;
        }

        var i = url.lastIndexOf(".");
        var ext = (i >= 0) ? url.substring(i) : "";
        if (ext.isImageFile()) result = "iamge" + this.getUID() + ext;
        else result = "doc" + this.getUID() + ext;

        if (i !== 0) this._mapFileName[url] = result;
        return result;
    }, _mapFileName: {}

};

appcan.ready(function () {
    appcan.xwin.prepare();
});