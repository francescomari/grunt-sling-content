module.exports = function (grunt) {
    grunt.initConfig({
        slingPost: {
            options: {
                host: 'localhost',
                port: '8080',
                user: 'admin',
                pass: 'admin'
            },
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

    grunt.registerTask("default", ["slingPost:content", "slingPost:apps"]);
};