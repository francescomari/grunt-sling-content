module.exports = function (grunt) {
    grunt.initConfig({
        slingPost: {
            content: {
                dest: "/content",
                src: "root/content"
            },
            apps: {
                dest: "/apps",
                src: "root/apps"
            }
        }
    });

    grunt.loadTasks("../../tasks");

    grunt.registerTask("default", ["slingPost"]);
};