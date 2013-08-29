var util = require("util");
var path = require("path");
var async = require("async");

var servlet = require("./lib/servlet");

var tasks = require("./lib/tasks");

module.exports = function (grunt) {
    grunt.registerMultiTask("slingImport", function () {
        new tasks.SlingImport(grunt, this).run();
    });
};