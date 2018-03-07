/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const path = require('path');
const bunyan = require('bunyan');
const colors = require('colors/safe');

const endsWith = (str, suffix) => str.slice(-suffix.length) === suffix;

const lpad = function(str, count, fill) {
    if (fill == null) { fill = ' '; }
    str = `${str}`;
    while (str.length < count) { str = fill + str; }
    return str;
};

// Convert a `date` into a syslog style "Nov 6 10:30:21".
exports.dateToString = (function() {
    const MONTHS = [
        'Jan', 'Feb', 'Mar', 'Apr',
        'May', 'Jun', 'Jul', 'Aug',
        'Sep', 'Oct', 'Nov', 'Dec'
    ];

    return function(date) {
        let timestamp;
        const time = [
            (lpad(date.getHours(),   2, '0')),
            (lpad(date.getMinutes(), 2, '0')),
            (lpad(date.getSeconds(), 2, '0'))
        ].join(':');

        return timestamp = [MONTHS[date.getMonth()], date.getDate(), time].join(' ');
    };
})();

// Applies one or more colors to a message, and returns the colorized message.
const applyColors = (exports.applyColors = function(message, colorList) {
    if ((message == null)) { return message; }

    for (let color of Array.from(colorList)) {
        message = colors[color](message);
    }

    return message;
});

// Transforms "/src/foo/bar.coffee" to "/s/f/bar".
// Transforms "/src/foo/index.coffee" to "/s/foo/".
const toShortFilename = (exports.toShortFilename = function(filename, basepath=null, replacement) {
    let shortenIndex;
    if (replacement == null) { replacement = "./"; }
    if (basepath != null) {
        if (exports.isString(basepath) && !endsWith(basepath, path.sep)) { basepath += path.sep; }
        filename = filename.replace(basepath, replacement);
    }

    const parts = filename.split(path.sep);

    let file  = parts[parts.length - 1];
    const ext   = path.extname(file);
    file  = path.basename(file, ext);

    if (file === 'index') {
        shortenIndex = parts.length - 3;
        file = '';
    } else {
        shortenIndex = parts.length - 2;
    }

    // Strip the extension
    parts[parts.length - 1] = file;
    for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        if (index <= shortenIndex) { parts[index] = parts[index][0]; }
    }

    return parts.join('/');
});

// Transforms a bunyan `src` object (a `{file, line, func}` object) into a human readable string.
exports.srcToString = function(src, basepath=null, replacement) {
    if (replacement == null) { replacement = "./"; }
    if ((src == null)) { return ''; }

    const file = ((src.file != null) ? toShortFilename(src.file, basepath, replacement) : '') +
        ((src.line != null) ? `:${src.line}` : '');

    const answer = (src.func != null) && file ?
        `${src.func} (${file})`
    : (src.func != null) ?
        src.func
    : file ?
        file
    :
        '';

    return answer;
};

const EXPRESS_BUNYAN_LOGGER_FIELDS = ['remote-address', 'ip', 'method', 'url', 'referer', 'user-agent',
    'body', 'short-body', 'http-version', 'response-time', 'status-code', 'req-headers',
    'res-headers', 'incoming'];

// Borrowed from lodash
exports.isString = value =>
    (typeof value === 'string') ||
        (value && (typeof value === 'object') && (toString.call(value) === '[object String]')) ||
        false
;
