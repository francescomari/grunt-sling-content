module.exports = function (grunt) {
    grunt.initConfig({
        jshint: {
            all: ["tasks/**/*.js", "tests/**/*.js", "Gruntfile.js"]
        },
        nodeunit: {
            all: ["tests/test-*.js"]
        }
    });

    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-nodeunit");

    grunt.registerTask("test", ["jshint", "nodeunit"]);

    grunt.registerTask("default", ["test"]);
};