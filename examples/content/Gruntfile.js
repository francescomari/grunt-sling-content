module.exports = function (grunt) {
    grunt.initConfig({
        slingImport: {
            options: {
                replace: true
            },
            all: {
                src: "src/*",
                dest: "/"
            }
        }
    });

    grunt.loadTasks("../../tasks");

    grunt.registerTask("default", ["slingImport"]);
};