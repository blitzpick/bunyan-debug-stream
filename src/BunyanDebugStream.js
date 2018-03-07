/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let exports;
const path               = require('path');
const {Writable}         = require('stream');

const bunyan             = require('bunyan');
const colors             = require('colors/safe');
const exceptionFormatter = require('exception-formatter');
var jsome = require('jsome');

const {srcToString, applyColors, dateToString, isString} = require('./utils');

// A list of various properties for the different bunyan levels.
const LEVELS = (function() {
    const answer = {};
    const o = (level, prefix, colors) => answer[level] = {level, prefix, colors};

    o(bunyan.TRACE, 'TRACE:', ['grey']);
    o(bunyan.DEBUG, 'DEBUG:', ['cyan']);
    o(bunyan.INFO,  'INFO: ', ['green']);
    o(bunyan.WARN,  'WARN: ', ['yellow']);
    o(bunyan.ERROR, 'ERROR:', ['red']);
    o(bunyan.FATAL, 'FATAL:', ['magenta']);

    return answer;
})();

// A list of fields to not print, either because they are boring or because we explicitly pull them
// out and format them in some special way.
const FIELDS_TO_IGNORE = ['src', 'msg', 'name', 'hostname', 'pid', 'level', 'time', 'v', 'err'];

// express-bunyan-logger adds a bunch of fields to the `req`, and we don't wnat to print them all.
const EXPRESS_BUNYAN_LOGGER_FIELDS = [
    'remote-address', 'ip', 'method', 'url', 'referer', 'user-agent', 'body', 'short-body',
    'http-version', 'response-hrtime', 'status-code', 'req-headers', 'res-headers', 'incoming',
    'req_id'
];

// This takes log entries from Bunyan, and pretty prints them to the console.
//
class BunyanDebugStream extends Writable {
    //
    // * `options.colors` is a hash where keys are Bunyan log levels (e.g. `bunyan.DEBUG`) and values
    //   are an array of colors (e.g. `['magenta', 'bold']`.)  Uses the `colors` module to apply
    //   all colors to the message before logging.  You can also set `options.colors` to `false`
    //   to disable colors.
    // * `options.forceColor` will turn color on, even if not using a TTY output.
    // * `options.basepath` is the absolute path of the root of your project.  If you're creating
    //   this `BunyanDebugStream` from a file called `app.js` in the root of your project, then
    //   this should be `__dirname`.
    // * `options.basepathReplacement` is a string to replace `options.basepath` with in filenames.
    //   Defaults to '.'.
    // * `options.showProcess` if true then will show "processName loggerName[pid]" in the output.
    //   If false (the default) then this will just be "loggerName[pid]".
    // * `options.processName` is the name of this process.  Defaults to the filename of the second
    //   argument in `process.argv` (on the assumption that you're running something like
    //   `node myApp.js`.)
    // * `options.maxExceptionLines` is the maximum number of lines to show in a stack trace.
    // * `options.stringifiers` is similar to Bunyan's serializers, but will be used to turn
    //   properties in log entries into strings.  A `null` stringifier can be used to hide a
    //   property from the logs.
    // * `options.prefixers` is similar to `options.stringifiers` but these strings will be prefixed
    //   onto the beginning of the `msg`, and wrapped in "[]".
    // * `options.out` is the stream to write data to.  Defaults to `process.stdout`.
    //
    constructor(options) {
        let left, left1, level, levelValue;
        {
          // Hack: trick Babel/TypeScript into allowing this before super.
          if (false) { super(); }
          let thisFn = (() => { this; }).toString();
          let thisName = thisFn.slice(thisFn.indexOf('{') + 1, thisFn.indexOf(';')).trim();
          eval(`${thisName} = this;`);
        }
        if (options == null) { options = {}; }
        this.options = options;
        super({objectMode: true});

        // Enable colors for non-tty stdout
        if (this.options.forceColor) { colors.enabled = true; }

        // Compile color options
        this._colors = {};
        // Parse any options
        if (('colors' in this.options) && !this.options.colors) {
            // B&W for us.
            this._useColor = false;
            for (levelValue in LEVELS) {
                level = LEVELS[levelValue];
                this._colors[levelValue] = [];
            }
        } else {
            this._useColor = true;

            // Load up the default colors
            for (levelValue in LEVELS) {
                level = LEVELS[levelValue];
                this._colors[levelValue] = level.colors;
            }

            // Add in any colors from the options.
            const object = this.options.colors != null ? this.options.colors : {};
            for (level in object) {
                let c = object[level];
                if (isString(c)) { c = [c]; }
                if (this._colors[level] != null) {
                    this._colors[level] = c;
                } else {
                    const levelName = level;
                    level = bunyan[levelName != null ? levelName.toUpperCase() : undefined];
                    if (this._colors[level] != null) {
                        this._colors[level] = c;
                    }
                    else {}
                }
            }
        }
                        // I don't know what to do with this...

        this._processName = (left = (left1 = this.options.processName != null ? this.options.processName : ( process.argv.length > 1 ? path.basename(process.argv[1], path.extname(process.argv[1])) : undefined )) != null ? left1 : ( process.argv.length > 0 ? path.basename(process.argv[0], path.extname(process.argv[0])) : undefined )) != null ? left : '';

        const self = this;
        this._stringifiers = {
            req: exports.stdStringifiers.req,
            err: exports.stdStringifiers.err
        };
        if (this.options.stringifiers != null) {
            for (let key in this.options.stringifiers) { const value = this.options.stringifiers[key]; this._stringifiers[key] = value; }
        }

        // Initialize some defaults
        this._prefixers = this.options.prefixers != null ? this.options.prefixers : {};
        this._basepath = this.options.basepath != null ? this.options.basepath : process.cwd();
        this._indent = this.options.indent != null ? this.options.indent : "  ";

        this._showDate = this.options.showDate != null ? this.options.showDate : true;
        this._showLoggerName = this.options.showLoggerName != null ? this.options.showLoggerName : true;
        this._showPid = this.options.showPid != null ? this.options.showPid : true;
        this._showLevel = this.options.showLevel != null ? this.options.showLevel : true;
    }

    // Runs a stringifier.
    // Appends any keys consumed to `consumed`.
    //
    // Returns `{value, message}`.  If the `stringifier` returns `repalceMessage = true`, then
    // `value` will be null and `message` will be the result of the stringifier.  Otherwise
    // `message` will be the `message` passed in, and `value` will be the result of the stringifier.
    //
    _runStringifier(entry, key, stringifier, consumed, message) {
        consumed[key] = true;
        let value = null;
        let newMessage = message;

        try {
            if ((stringifier == null)) {
                // Null stringifier means we hide the value
            } else {
                const result = stringifier(entry[key], {
                    entry,
                    useColor: this._useColor,
                    debugStream: this
                });
                if ((result == null)) {
                    // Hide the value
                } else if (isString(result)) {
                    value = result;
                } else {
                    for (key of Array.from((result.consumed != null ? result.consumed : []))) { consumed[key] = true; }
                    if (result.value != null) {

                        if (result.replaceMessage) {
                            newMessage = result.value;
                            value = null;
                        } else {
                            ({ value } = result);
                        }
                    }
                }
            }

        } catch (err) {
            // Go back to the original message
            newMessage = message;
            value = `Error running stringifier:\n${err.stack}`;
        }

        // Indent the result correctly
        if (value != null) {
            value = value.replace(/\n/g, `\n${this._indent}`);
        }

        return {message: newMessage, value};
    }

    _entryToString(entry) {
        let value;
        if (typeof(entry) === 'string') { entry = JSON.parse(entry); }

        const colorsToApply = this._colors[entry.level != null ? entry.level : bunyan.INFO];

        // src is the filename/line number
        let src = srcToString(entry.src, this._basepath, this.options.basepathReplacement);
        if (src) { src += ': '; }

        let message = entry.msg;

        const consumed = {};
        for (let field of Array.from(FIELDS_TO_IGNORE)) { consumed[field] = true; }

        // Run our stringifiers
        const values = [];
        for (var key in this._stringifiers) {
            const stringifier = this._stringifiers[key];
            if (entry[key] != null) {
                ({message, value} = (message = this._runStringifier(entry, key, stringifier, consumed, message)));
                if (value != null) { values.push(`${this._indent}${key}: ${value}`); }
            } else {
                consumed[key] = true;
            }
        }

        // Run our prefixers
        let prefixes = [];
        for (key in this._prefixers) {
            const prefixer = this._prefixers[key];
            if (entry[key] != null) {
                ({message, value} = this._runStringifier(entry, key, prefixer, consumed, message));
                if (value != null) { prefixes.push(value); }
            } else {
                consumed[key] = true;
            }
        }


        const json = {};
        // Use JSON.stringify on whatever is left
        for (key in entry) {
            // Skip fields we don't care about
            if (consumed[key]) { continue; }
            json[key] = value;
        }

        prefixes = prefixes.length > 0 ? `[${prefixes.join(',')}] ` : '';

        const date = this._showDate ? `${dateToString(entry.time != null ? entry.time : new Date())} ` : '';
        let processStr = "";
        if (this.options.showProcess) {  processStr += this._processName; }
        if (this._showLoggerName) {      processStr += entry.name; }
        if (this._showPid) {             processStr += `[${entry.pid}]`; }
        if (processStr.length > 0) { processStr += " "; }
        const levelPrefix = this._showLevel ? ((LEVELS[entry.level] != null ? LEVELS[entry.level].prefix : undefined) != null ? (LEVELS[entry.level] != null ? LEVELS[entry.level].prefix : undefined) : '      ') + ' ' : '';

        let line = `\
${date}${processStr}${levelPrefix}${src}${prefixes}${applyColors(message, colorsToApply)}\
`;

        if (typeof request !== 'undefined' && request !== null) { line += `\n${this._indent}${request}`; }
        if (values.length > 0) { line += `\n${values.map(v => applyColors(v, colorsToApply)).join('\n')}`; }
        return {line, json};
    }

    _write(entry, encoding, done) {
        process.stdout.write(this._entryToString(entry.line) + "\n");
        jsome(entry.json)
        return done();
    }
}

module.exports = (exports = options => new BunyanDebugStream(options));

// Build our custom versions of the standard Bunyan serializers.
const serializers = (module.exports.serializers = {});

for (let serializerName in bunyan.stdSerializers) {
    const serializer = bunyan.stdSerializers[serializerName];
    serializers[serializerName] = serializer;
}

serializers.req = function(req) {
    const answer = bunyan.stdSerializers.req(req);
    if (answer != null) {
        if (req.user != null) {
            answer.user = req != null ? req.user : undefined;
        }
    }
    return answer;
};

serializers.res = function(res) {
    const answer = bunyan.stdSerializers.res(res);
    if (answer != null) {
        answer.headers = res._headers;
        if (res.responseTime != null) {
            answer.responseTime = res.responseTime;
        }
    }
    return answer;
};

exports.stdStringifiers = {
    req(req, {entry, useColor}) {
        let status;
        let consumed = ['req', 'res'];
        const { res } = entry;

        if ((entry['status-code'] != null) && (entry['method'] != null) && (entry['url'] != null) && (entry['res-headers'] != null)) {
            // This is an entry from express-bunyan-logger.  Add all the fields to `consumed`
            // so we don't print them out.
            consumed = consumed.concat(EXPRESS_BUNYAN_LOGGER_FIELDS);
        }

        // Get the statusCode
        const statusCode = (res != null ? res.statusCode : undefined) != null ? (res != null ? res.statusCode : undefined) : entry['status-code'];
        if (statusCode != null) {
            status = `${statusCode}`;
            if (useColor) {
                const statusColor = statusCode < 200 ? colors.grey 
                    : statusCode < 400 ? colors.green 
                    : colors.red;
                status = colors.bold(statusColor(status));
            }
        } else {
            status = "";
        }

        // Get the response time
        let responseTime = (() => {
            if ((res != null ? res.responseTime : undefined) != null) { return res.responseTime; 
            } else if (entry.duration != null) {
                // bunyan-middleware stores response time in 'duration'
                consumed.push('duration');
                return entry.duration;
            } else if (entry["response-time"] != null) {
                // express-bunyan-logger stores response time in 'response-time'
                consumed.push("response-time");
                return entry["response-time"];
            } else {
                return null;
            }
        })();
        if (responseTime != null) {
            responseTime = `${responseTime}ms`;
        } else {
            responseTime = "";
        }

        // Get the user
        const user = (() => {
            if (req.user != null) {
            let left;
            return `${(left = (req.user != null ? req.user.username : undefined) != null ? (req.user != null ? req.user.username : undefined) : (req.user != null ? req.user.name : undefined)) != null ? left : req.user}@`;
        } else if (entry.user != null) {
            let left1;
            consumed.push("user");
            return `${(left1 = (entry.user != null ? entry.user.username : undefined) != null ? (entry.user != null ? entry.user.username : undefined) : (entry.user != null ? entry.user.name : undefined)) != null ? left1 : entry.user}@`;
        } else {
            return "";
        }
        })();

        // Get the content length
        let contentLength = __guard__(res != null ? res.headers : undefined, x => x['content-length']) != null ? __guard__(res != null ? res.headers : undefined, x => x['content-length']) : (entry['res-headers'] != null ? entry['res-headers']['content-length'] : undefined);
        contentLength = (contentLength != null) ? `- ${contentLength} bytes` : "";

        const host = (req.headers != null ? req.headers.host : undefined) || null;
        const url = (host != null) ? `${host}${req.url}` : `${req.url}`;

        let fields = [req.method, user + url, status, responseTime, contentLength];
        fields = fields.filter(f => !!f);
        const request = fields.join(' ');

        // If there's no message, then replace the message with the request
        const replaceMessage = !entry.msg ||
            (entry.msg === 'request finish'); // bunyan-middleware

        return {consumed, value: request, replaceMessage};
    },

    err(err, {useColor, debugStream}) {
        return exceptionFormatter(err, {
            format: useColor ? 'ansi' : 'ascii',
            colors: false, // TODO ?
            maxLines: (debugStream.options != null ? debugStream.options.maxExceptionLines : undefined) != null ? (debugStream.options != null ? debugStream.options.maxExceptionLines : undefined) : null,
            basepath: debugStream._basepath,
            basepathReplacement: (debugStream.options != null ? debugStream.options.basepathReplacement : undefined)
        });
    }
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}