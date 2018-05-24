"use strict";

/** 
 * Extract the host part of a url.
 */
function getURLHost(url) {
    if (url === undefined)
        return "";

    if (url.startsWith("http://"))
        url = url.substring(7);
    if (url.startsWith("https://"))
        url = url.substring(8);

    var domain = url;
    if (url.indexOf("/") >= 0) {
        domain = url.substring(0, url.indexOf("/"));
    }
    return domain;
};

// Check if the url is of wikipedia.org domain.
function isWikipediaDomain(url) {
    return getURLHost(url).endsWith("wikipedia.org");
};

// Set an object property to the given value, if it doesn't exist already. If
// the object is undefined however, it's a nop
function setValueIfNotExists(obj, key, val) {
    if (obj === undefined)
        return;
    if (!(key in obj))
        obj[key] = val;
};

// Returns a string containing full year, month and day. Such strings can be used as keys
// for storing daywise browsing data in local storage.
function getDateKey() {
    var now = new Date();
    return now.getFullYear() + ":" + now.getMonth() + ":" + now.getDate();
}

// Return the time of next midnight.
// when time = May 21, 11:59:59 PM -> return May 22, 12:00:00 AM
// when time = May 21, 12:00:00 AM -> return May 22, 12:00:00 AM
function getNextMidnightTime() {
    var now = new Date();
    // Clear out the hours, minutes and seconds fields.
    now.setHours(0);
    now.setMinutes(0);
    now.setSeconds(0);

    // Increment the day by 1(this will automatically increment the month, year
    // fields if necessary)
    now.setDate(now.getDate() + 1);
    return now;
};

// Return a string describing the contents(key/values) of the passed object. Useful
// for debugging purposes.
function getPropString(obj) {
    if (obj === undefined) {
        return "undefined";
    }
    var ret = "";
    for (var key in obj) {
        ret += key + ": " + obj[key] + ",";
    }

    if (ret.length > 0) {
        ret = ret.substring(0, ret.length - 1);
    }

    return ret;
}

// Return a string concatenating all the given array elements with the given delimiter.
function arrayElemsToString(arr, delim) {
    if (delim === undefined)
        delim = " ";
    var ret = "";
    for (var i = 0;i < arr.length; ++i) {
        ret += arr[i];
        if (i < arr.length - 1)
            ret += delim;
    }
    return ret;
}

export {getURLHost, getPropString, getDateKey, setValueIfNotExists, isWikipediaDomain, 
        getNextMidnightTime, arrayElemsToString};
