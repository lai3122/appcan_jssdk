"use strict";

var appLog = {
    /**
     * log
     * @param s  {Any...}
     */
    log: function (s) {
        if (this._isEnabled) this._send("log", Array.prototype.slice.apply(arguments));
    },

    /**
     * warn
     * @param s  {Any...}
     */
    warn: function (s) {
        if (this._isEnabled) this._send("warn", Array.prototype.slice.apply(arguments));
    },

    /**
     * error
     * @param s  {Any...}
     */
    error: function (s) {
        if (this._isEnabled) this._send("error", Array.prototype.slice.apply(arguments));
    },

    _send: function (t, sa) {
        var err;
        try {
            eval("KuwGRowI8;")
        } catch (e) {
            var stack = e.stack.split("\n");
            var line = stack[4];
            err = line.match(/.*[ \/](.+):(\d+):(\d+)/);
        }

        var ret = "";
        if (sa) {
            for (var i = 0; i < sa.length; i++) {
                var s = sa[i];
                if (s !== undefined) {
                    if (Object.prototype.toString.call(s) === '[object String]') ret += ", " + s;
                    else ret += ", " + JSON.stringify(s);
                }
            }

            if (ret !== "") ret = ret.substring(2);
        }

        this._sendlog("[ " + err[1] + " line : " + err[2] + "," + err[3] + " " + t + " ] " + ret);
    },

    _sendlog: function (s) {
        if (this._appcanIsReady) {
            if (window.uexLog) uexLog.sendLog(s);
        } else {
            this._logs.push(s);
        }
    },
    _logs: [],
    _appcanIsReady: false,

    get _isEnabled() {
        if ((this._enablefunc === false) || (this._appcanIsReady && !window.uexLog)) return false;
        if (this._enablefunc === true) return true;

        if (Object.prototype.toString.call(this._enablefunc) === '[object Function]') {
            try {
                return !!this._enablefunc();
            } catch (e) {
                return false;
            }
        } else {
            return !!this._enablefunc;
        }
    },

    /**
     * enable
     * @param b   {boolean | function : boolean}, default true
     */
    enable: function (b) {
        this._enablefunc = b;
    },
    _enablefunc: true
};

appcan.ready(function () {
    var thiz = appLog;
    thiz._appcanIsReady = true;

    if (window.uexLog) {
        for (var i = 0; i < thiz._logs.length; i++) {
            uexLog.sendLog(thiz._logs[i]);
        }
    }

    thiz._logs = [];
});