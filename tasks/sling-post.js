var tasks = require("./lib/tasks");

module.exports = function (grunt) {
    grunt.registerMultiTask("slingPost", function () {
        new tasks.SlingPost(grunt, this).run();
    });
};