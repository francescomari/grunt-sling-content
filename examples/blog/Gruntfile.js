module.exports = function (grunt) {
    grunt.initConfig({
        "sling-content": {
            root: "root"
        }
    });

    grunt.loadTasks("../../tasks");

    grunt.registerTask("default", ["sling-content"]);
};