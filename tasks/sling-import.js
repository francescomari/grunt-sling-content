var tasks = require("./lib/tasks");

module.exports = function (grunt) {
    grunt.registerMultiTask("slingImport", function () {
        new tasks.SlingImport(grunt, this).run();
    });
};